import { Amounts } from "./amounts.js"

export class Order{
    id: number
    dateCreation: string
    amounts: Amounts[]
    payment: string
    address: string
    profile: string
    by?: string
}