import dotenv from 'dotenv';
import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import url from "url";
import path, { join } from 'path'
import cors, { CorsOptions } from 'cors'
import { WebSocket } from 'ws';
import { Client, StompSubscription } from '@stomp/stompjs'
import { DateTime } from 'luxon'
import axios from 'axios';
import chalk from 'chalk';

dotenv.config()

const PORT = process.env.PORT || 4040
const URL_PEDIDOS_API = process.env['API_PEDIDOS']
const URL_PEDIDOS_API_HTTP = process.env['API_PEDIDOS_HTTP']

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
    path: '/realtime'
})

const token = (await getAuthToken()).data

const stomp = new Client({
    brokerURL: URL_PEDIDOS_API,
    webSocketFactory: () => new WebSocket(URL_PEDIDOS_API, {
        headers: {
            Authorization: `Bearer ${token}`
        }
    }),
    heartbeatIncoming: 10000,
    heartbeatOutgoing: 10000,
    reconnectDelay: 5000,
})

stomp.activate()


stomp.onDisconnect = () => {
    console.log(chalk.red("Desconectou"))
}

function run(): void {
    httpServer.listen(PORT, () => {
        console.log(chalk.blue.bold(`Servidor iniciado na porta: ${PORT}`))
        console.log(chalk.blue.bold(`Inicializado as ${DateTime.now()}`))
    })
}

async function getAuthToken() {
    return new Promise<any>((resolve, reject) => {
        let tentativas = 0
        let interval = setInterval(async () => {
            if (tentativas < 10) {
                try {
                    console.log(chalk.blue.bold(`Tentativa N° ${tentativas + 1} a conectar ao servidor`))
                    const result = await axios.post<string>(`${URL_PEDIDOS_API_HTTP}/accounts/login`, {}, {
                        params: {
                            user: process.env['API_PEDIDOS_USER'],
                            password: process.env['API_PEDIDOS_PASSWORD'],
                            expire: false
                        }, responseType: 'text'
                    })
                    if(result){
                        clearInterval(interval)
                        resolve(result)
                    }
                } catch (ex) {
                    console.log(ex.errors)
                    tentativas++;
                }
            } else {
                reject()
            }
        }, 5000)
    })
}

export { run, io, app, stomp }