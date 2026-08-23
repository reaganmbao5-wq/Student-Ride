import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getBackendUrl } from '../utils/urlHelpers';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  const [newRideRequest, setNewRideRequest] = useState(null);
  const [removedSharedRideId, setRemovedSharedRideId] = useState(null);
  const [rideUpdate, setRideUpdate] = useState(null);
  const [routeQueueUpdate, setRouteQueueUpdate] = useState(null);
  const [driverTripSegments, setDriverTripSegments] = useState(null);
  const [passengerBriefing, setPassengerBriefing] = useState(null);
  const [newMessage, setNewMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);
  const reconnectAttemptRef = useRef(0);

  const connect = useCallback(() => {
    if (!user || !token) return;

    if (wsRef.current && (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING)) {
      return;
    }

    const backendUrl = getBackendUrl();
    const wsUrl = backendUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/ws?token=${token}`);

    ws.onopen = () => {
      console.log('WEBSOCKET_CONNECTED');
      setIsConnected(true);
      reconnectAttemptRef.current = 0;
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);

      // Exponential backoff reconnect: 3s, 6s, 12s, 30s, 60s
      const backoffIntervals = [3000, 6000, 12000, 30000, 60000];
      const attempt = reconnectAttemptRef.current;
      const delay = attempt < backoffIntervals.length ? backoffIntervals[attempt] : 60000;

      reconnectAttemptRef.current += 1;

      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        switch (data.type) {
          case 'new_ride_request':
            setNewRideRequest(data.ride);
            break;
          case 'shared_ride_cancelled':
          case 'shared_ride_accepted_by_other':
            setRemovedSharedRideId(data.ride_id);
            break;
          case 'ride_accepted':
            setRideUpdate({ type: 'accepted', ride: data.ride, driver: data.driver });
            break;
          case 'driver_arrived':
            setRideUpdate({ type: 'driver_arrived', ride_id: data.ride_id });
            break;
          case 'ride_state_changed':
            setRideUpdate({ type: 'state_changed', state: data.state, ride_id: data.ride_id });
            break;
          case 'ride_started':
            setRideUpdate({ type: 'started', ride_id: data.ride_id });
            break;
          case 'ride_completed':
            setRideUpdate({ type: 'completed', ride_id: data.ride_id, fare: data.fare });
            break;
          case 'ride_cancelled':
            setRideUpdate({ type: 'cancelled', ride_id: data.ride_id });
            break;
          case 'driver_cancelled_reassigning':
            setRideUpdate({ type: 'reassigning', ride_id: data.ride_id });
            break;
          case 'driver_location': {
            const locLat = data.lat !== undefined ? data.lat : (data.location?.lat || data.location?.latitude);
            const locLng = data.lng !== undefined ? data.lng : (data.location?.lng || data.location?.longitude);
            const locHeading = data.heading !== undefined ? data.heading : (data.location?.heading || 0);
            
            setDriverLocation({ 
              location: { lat: locLat, lng: locLng, heading: locHeading }, 
              ride_id: data.ride_id 
            });
            break;
          }
          case 'new_message':
            setNewMessage(data.message);
            break;
          case 'rating_received':
            setRideUpdate({
              type: 'rating_received',
              rating: data.rating,
              new_average: data.new_average,
              ride_id: data.ride_id
            });
            break;
          case 'wallet_updated':
            setRideUpdate({
              type: 'wallet_updated',
              wallet_balance: data.wallet_balance,
              wallet_status: data.wallet_status
            });
            break;
          case 'capacity_changed':
            setRideUpdate({
              type: 'capacity_changed',
              available_seats: data.available_seats,
              active_passengers: data.active_passengers
            });
            break;
          case 'routeQueueUpdate':
            setRouteQueueUpdate(data.route_queue);
            break;
          case 'trip_updated':
            if (data.route_queue) {
              setRouteQueueUpdate(data.route_queue);
            }
            if (data.full_driver_segments) {
              setDriverTripSegments(data.full_driver_segments);
            }
            break;
          case 'passenger_briefing_update':
            setPassengerBriefing(prev => {
              const isSameRide = Boolean(prev && prev.ride_id && prev.ride_id === data.ride_id);
              const incomingSegs = data.route_segments || [];
              const incomingGeo = data.route_geometry || [];
              const isValidGeo = incomingGeo && incomingGeo.length > 2;
              
              // HARDENING RULE: Preserve last valid route and ETA ONLY within the SAME active ride
              return {
                ride_id: data.ride_id,
                briefing_text: data.briefing_text,
                x3_state: data.x3_state,
                is_pinned: Boolean(data.is_pinned),
                carousel_messages: data.carousel_messages || [],
                stops_remaining: data.stops_remaining,
                is_next_stop: data.is_next_stop,
                intermediate_stops: (data.intermediate_stops && data.intermediate_stops.length > 0) 
                  ? data.intermediate_stops 
                  : (isSameRide ? (prev?.intermediate_stops || []) : []),
                route_segments: (incomingSegs.length > 0) 
                  ? incomingSegs 
                  : (isSameRide ? (prev?.route_segments || []) : []),
                route_geometry: isValidGeo 
                  ? incomingGeo 
                  : (isSameRide ? (prev?.route_geometry || []) : []),
                // HARDENING RULE: Preserve last valid ETA ONLY within the SAME active ride
                eta_seconds: (data.eta_seconds !== undefined && data.eta_seconds !== null) 
                  ? data.eta_seconds 
                  : (isSameRide ? (prev?.eta_seconds ?? null) : null),
                eta_text: (data.eta_text && data.eta_text.trim() !== '') 
                  ? data.eta_text 
                  : (isSameRide ? (prev?.eta_text || null) : null)
              };
            });
            break;
          case 'pong':
            // Keep-alive response
            break;
          default:
            console.log('Unknown message type:', data.type);
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    wsRef.current = ws;
  }, [user, token]);

  useEffect(() => {
    connect();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
          console.log('App became visible, forcing WebSocket reconnect...');
          connect();
        }
      }
    };

    const handleOnline = () => {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        console.log('Network became online, forcing WebSocket reconnect...');
        connect();
      }
    };

    window.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [connect]);

  // Keep-alive ping
  useEffect(() => {
    const pingInterval = setInterval(() => {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);

    return () => clearInterval(pingInterval);
  }, []);

  const sendLocationUpdate = useCallback((lat, lng) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'location_update',
        location: { lat, lng }
      }));
    }
  }, []);

  const requestHardRecalculation = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'request_hard_recalculation'
      }));
    }
  }, []);

  const clearRideRequest = useCallback(() => {
    setNewRideRequest(null);
  }, []);

  const clearRemovedSharedRideId = useCallback(() => {
    setRemovedSharedRideId(null);
  }, []);

  const clearRideUpdate = useCallback(() => {
    setRideUpdate(null);
  }, []);

  const clearNewMessage = useCallback(() => {
    setNewMessage(null);
  }, []);

  const clearRouteQueueUpdate = useCallback(() => {
    setRouteQueueUpdate(null);
  }, []);

  const value = {
    isConnected,
    newRideRequest,
    removedSharedRideId,
    rideUpdate,
    routeQueueUpdate,
    driverTripSegments,
    driverLocation,
    passengerBriefing,
    newMessage,
    sendLocationUpdate,
    requestHardRecalculation,
    clearRideRequest,
    clearRemovedSharedRideId,
    clearRideUpdate,
    clearRouteQueueUpdate,
    clearNewMessage,
    setPassengerBriefing
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
};

export const useWebSocket = () => {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

export default WebSocketContext;
