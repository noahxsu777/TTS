import { useEffect, useRef, useCallback, useState } from 'react';
import type { WSMessage } from '../types';

interface UseWebSocketOptions {
  onMessage?: (msg: WSMessage) => void;
  maxReconnectAttempts?: number;
}

export type WSStatus = 'idle' | 'connecting' | 'open' | 'closed' | 'error';

export function useWebSocket(url: string, options: UseWebSocketOptions = {}) {
  const { onMessage, maxReconnectAttempts = 15 } = options;
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [status, setStatus] = useState<WSStatus>('idle');
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    // Already connecting or open
    if (wsRef.current && (wsRef.current.readyState === WebSocket.CONNECTING || wsRef.current.readyState === WebSocket.OPEN)) return;

    setStatus('connecting');
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus('open');
      reconnectRef.current = 0;
    };

    ws.onmessage = (ev) => {
      try {
        const msg: WSMessage = JSON.parse(ev.data as string);
        if (msg.type !== 'ping') {
          onMessageRef.current?.(msg);
        }
      } catch { /* ignore malformed */ }
    };

    ws.onerror = () => setStatus('error');

    ws.onclose = () => {
      setStatus('closed');
      wsRef.current = null;
      if (reconnectRef.current < maxReconnectAttempts) {
        const delay = Math.min(1000 * Math.pow(1.8, reconnectRef.current), 30000);
        reconnectRef.current += 1;
        timerRef.current = setTimeout(connect, delay);
      }
    };
  }, [url, maxReconnectAttempts]);

  const send = useCallback((data: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  }, []);

  const disconnect = useCallback(() => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    reconnectRef.current = maxReconnectAttempts; // prevent auto-reconnect
    wsRef.current?.close();
  }, [maxReconnectAttempts]);

  useEffect(() => {
    connect();
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  return { status, send, disconnect, reconnect: connect };
}
