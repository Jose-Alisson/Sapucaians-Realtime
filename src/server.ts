import dotenv from 'dotenv';
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import url from "url";
import path, { join } from 'path'
import cors, { CorsOptions } from 'cors'
import { WebSocket } from 'ws';
import { Client } from '@stomp/stompjs'
import { DateTime } from 'luxon'

dotenv.config()

const PORT = process.env.PORT || 4040
const URL_PEDIDOS_API = process.env['API_PEDIDOS']
const PEDIDOS_TOKEN = process['TOKEN_PEDIDOS']

const app = express()
app.use(express.json());

const caminhoAtual = url.fileURLToPath(import.meta.url);
const diretorioPublico = path.join(caminhoAtual, "..", "..", "..", "public");

app.use(express.static(diretorioPublico));

app.use(cors({}));

const httpServer = http.createServer(app)

const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    },
    transports: ['websocket'],
    path: '/realtime/socket.io'
})

const stomp = new Client({
    brokerURL: URL_PEDIDOS_API,
    webSocketFactory: () => new WebSocket(URL_PEDIDOS_API),
    connectHeaders: {
        Authorization: `Baerar ${PEDIDOS_TOKEN}`
    },
    reconnectDelay: 5000,
})

stomp.activate()

function run(): void {
    httpServer.listen(PORT, () => {
        //console.log(`Servidor iniciado na porta: ${PORT}`)
        //console.log(`Inicializado as ${DateTime.now()}`)
    })
}

export { run, io, app, stomp }