import express from 'express';
import { Server as ioServer, Socket } from 'socket.io';
import http from 'http';
import cors from 'cors';
import { InMemoryDB, Room, User } from './db';
import { CONNECT, DISCONNECT, MESSAGE } from './constants';
import { ClientMessage, ServerMessage } from './types';

const app = express();
app.use(cors());
app.options('*', cors());
app.set('port', process.env.PORT || 80);

const server = http.createServer(app);
const io = new ioServer(server);
const db = new InMemoryDB();

const dummyRoom: Room = { id: 1, name: '1' };
db.addRoom(dummyRoom);

io.on(CONNECT, function (socket: Socket) {
  const connectedUser = handleOnConnect(socket);
  if (connectedUser === undefined) {
    socket.disconnect();
  }
  socket.on(MESSAGE, function (clientMessage: ClientMessage) {
    console.log(`Client ${socket.id} send ${clientMessage.payload}.`);
    const roomId = db.getRoomIdByUserId(socket.id);
    console.log(`Room addresses ${roomId}.`);
    const serverMessage: ServerMessage = {
      ...clientMessage,
      username: socket.id,
    };
    io.sockets.in(roomId.toString()).emit('message', serverMessage);
  });
  socket.on(DISCONNECT, function () {
    console.log(`Client ${socket.id} disconnected.`);
    db.removeUser(socket.id);
  });
});

server.listen(9001, function () {
  console.log('listening on *:9001');
});

export const handleOnConnect = (socket: Socket): User | undefined => {
  const roomId: string = socket.handshake.query['roomId'] as string;
  const userId = socket.id;
  const userName = socket.handshake.query['name'];
  console.log(typeof roomId);
  if (roomId && userId && userName) {
    const addedUser = db.addUser({ id: '', name: userName }, userId);
    if (addedUser) {
      const joinAction = db.joinRoom(userId, parseInt(roomId));
      if (joinAction) {
        socket.join(roomId);
        console.log(`Client ${socket.id} joined roomId ${roomId}.`);
        return addedUser;
      }
      // TODO: remove user from userList after join room failed
      db.removeUser(userId);
      return undefined;
    }
  }
  return undefined;
};
