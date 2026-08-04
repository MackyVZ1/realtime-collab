// src/workspace/workspace.gateway.ts
import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

interface DrawLineData {
  prevPoint: { x: number; y: number } | null;
  currentPoint: { x: number; y: number };
  color: string;
  width: number;
}

interface NoteData {
  id: string;
  x: number;
  y: number;
  text: string;
  color: string;
}

@WebSocketGateway({ cors: { origin: '*' } })
export class WorkspaceGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`⚡ User connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`🔴 User disconnected: ${client.id}`);
    client.broadcast.emit('user-left', client.id);
  }

  // 1. Cursor movement
  @SubscribeMessage('cursor-move')
  handleCursorMove(@ConnectedSocket() client: Socket, @MessageBody() data: { x: number; y: number }) {
    client.broadcast.emit('cursor-update', { id: client.id, x: data.x, y: data.y });
  }

  // 2. Whiteboard Drawing
  @SubscribeMessage('draw-line')
  handleDrawLine(@ConnectedSocket() client: Socket, @MessageBody() data: DrawLineData) {
    client.broadcast.emit('draw-line', data);
  }

  @SubscribeMessage('clear-canvas')
  handleClearCanvas(@ConnectedSocket() client: Socket) {
    client.broadcast.emit('clear-canvas');
  }

  // 3. Sticky Notes
  @SubscribeMessage('note-add')
  handleNoteAdd(@ConnectedSocket() client: Socket, @MessageBody() note: NoteData) {
    client.broadcast.emit('note-add', note);
  }

  @SubscribeMessage('note-update')
  handleNoteUpdate(@ConnectedSocket() client: Socket, @MessageBody() note: Partial<NoteData> & { id: string }) {
    client.broadcast.emit('note-update', note);
  }

  @SubscribeMessage('note-delete')
  handleNoteDelete(@ConnectedSocket() client: Socket, @MessageBody() id: string) {
    client.broadcast.emit('note-delete', id);
  }
}