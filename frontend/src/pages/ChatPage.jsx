import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send, Phone } from 'lucide-react';
import { GlassCard, GlassInput, GoldButton, LoadingSpinner } from '../components/common/GlassComponents';
import { useAuth } from '../context/AuthContext';
import { useWebSocket } from '../context/WebSocketContext';
import { toast } from 'sonner';
import { ChatPageSkeleton } from '../components/common/PageSkeletons';

const ChatPage = () => {
  const { rideId } = useParams();
  const navigate = useNavigate();
  const { user, api } = useAuth();
  const { newMessage, clearNewMessage } = useWebSocket();
  
  const [messages, setMessages] = useState([]);
  const [newMessageText, setNewMessageText] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [ride, setRide] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchMessages();
    fetchRide();
  }, [rideId]);

  useEffect(() => {
    if (newMessage && newMessage.ride_id === rideId) {
      setMessages(prev => [...prev, newMessage]);
      clearNewMessage();
    }
  }, [newMessage, rideId, clearNewMessage]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    try {
      const response = await api.get(`/chat/${rideId}`);
      setMessages(response.data);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRide = async () => {
    try {
      const response = await api.get('/rides/active');
      if (response.data && response.data.id === rideId) {
        setRide(response.data);
      }
    } catch (error) {
      console.error('Error fetching ride:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessageText.trim() || sending) return;

    setSending(true);
    try {
      const response = await api.post('/chat/send', {
        ride_id: rideId,
        content: newMessageText.trim()
      });
      
      setMessages(prev => [...prev, response.data]);
      setNewMessageText('');
    } catch (error) {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const getOtherParty = () => {
    if (!ride) return null;
    if (user?.role === 'driver') {
      return ride.student;
    } else {
      return ride.driver?.user;
    }
  };

  const otherParty = getOtherParty();

  if (loading) {
    return <ChatPageSkeleton />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" data-testid="chat-page">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate(-1)}
              className="p-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
              data-testid="back-btn"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                <span className="text-gold font-heading font-bold">
                  {otherParty?.name?.charAt(0) || '?'}
                </span>
              </div>
              <div>
                <p className="font-medium text-foreground">{otherParty?.name || 'Chat'}</p>
                <p className="text-xs text-muted-foreground">
                  {user?.role === 'driver' ? 'Passenger' : 'Driver'}
                </p>
              </div>
            </div>
          </div>
          
          {otherParty?.phone && (
            <a
              href={`tel:${otherParty.phone}`}
              className="p-3 rounded-xl bg-gold/10 hover:bg-gold/20 transition-colors"
              data-testid="call-btn"
            >
              <Phone className="w-5 h-5 text-gold" />
            </a>
          )}
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 pt-20 pb-24 px-4 overflow-y-auto">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground font-medium">No messages yet</p>
              <p className="text-muted-foreground/70 text-sm">Say hello to start the conversation</p>
            </div>
          ) : (
            messages.map((message, index) => {
              const isOwn = message.sender_id === user?.id;
              return (
                <div
                  key={message.id || index}
                  className={`flex ${isOwn ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl ${
                      isOwn
                        ? 'bg-amber-400 text-black font-medium rounded-br-sm shadow-md'
                        : 'bg-muted text-foreground border border-border rounded-bl-sm shadow-sm'
                    }`}
                  >
                    {!isOwn && (
                      <p className="text-xs font-semibold mb-1 text-muted-foreground">
                        {message.sender_name}
                      </p>
                    )}
                    <p className="text-sm leading-relaxed">{message.content}</p>
                    <p className={`text-[10px] mt-1 ${isOwn ? 'text-black/60' : 'text-muted-foreground'}`}>
                      {new Date(message.created_at).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/80 backdrop-blur-xl border-t border-border">
        <form onSubmit={handleSend} className="max-w-2xl mx-auto flex gap-3">
          <GlassInput
            type="text"
            placeholder="Type a message..."
            value={newMessageText}
            onChange={(e) => setNewMessageText(e.target.value)}
            className="flex-1"
            data-testid="message-input"
          />
          <GoldButton
            type="submit"
            size="icon"
            disabled={!newMessageText.trim() || sending}
            className="w-12 h-12"
            data-testid="send-btn"
          >
            <Send className="w-5 h-5" />
          </GoldButton>
        </form>
      </div>
    </div>
  );
};

export default ChatPage;
