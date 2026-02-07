import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './AuthContext';

const WebSocketContext = createContext(null);

export const WebSocketProvider = ({ children }) => {
  const { user, token } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [driverLocation, setDriverLocation] = useState(null);
  const [newRideRequest, setNewRideRequest] = useState(null);
  const [rideUpdate, setRideUpdate] = useState(null);
  const [newMessage, setNewMessage] = useState(null);
  const wsRef = useRef(null);
  const reconnectTimeoutRef = useRef(null);

  const connect = useCallback(() => {
    if (!user || !token) return;

    const wsUrl = process.env.REACT_APP_BACKEND_URL.replace('https://', 'wss://').replace('http://', 'ws://');
    const ws = new WebSocket(`${wsUrl}/ws/${user.id}`);

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);

      // Reconnect after 3 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
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
          case 'ride_accepted':
            setRideUpdate({ type: 'accepted', ride: data.ride, driver: data.driver });
            break;
          case 'driver_arrived':
            setRideUpdate({ type: 'driver_arrived', ride_id: data.ride_id });
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
          case 'driver_location':
            setDriverLocation({ location: data.location, ride_id: data.ride_id });
            break;
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

    return () => {
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

  const clearRideRequest = useCallback(() => {
    setNewRideRequest(null);
  }, []);

  const clearRideUpdate = useCallback(() => {
    setRideUpdate(null);
  }, []);

  const clearNewMessage = useCallback(() => {
    setNewMessage(null);
  }, []);

  const value = {
    isConnected,
    driverLocation,
    newRideRequest,
    rideUpdate,
    newMessage,
    sendLocationUpdate,
    clearRideRequest,
    clearRideUpdate,
    clearNewMessage
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
