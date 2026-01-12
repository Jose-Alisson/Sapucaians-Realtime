import { DateTime } from "luxon";

function timeToDate(number) {
    return new Date(number)
}

function formatarData(data) {
    const dia = String(data.getDate()).padStart(2, '0');
    const mes = String(data.getMonth() + 1).padStart(2, '0');
    const ano = data.getFullYear();

    return `${ano}-${mes}-${dia}`;
}

export function formatDate(data: any) {
    let date: any

    if (data instanceof DateTime) {
        date = data
    }

    if (typeof data === 'string') {
        date = DateTime.fromISO(data)
    }

    if (typeof data === 'number') {
        date = DateTime.fromMillis(data)
    }

    return {
        date: () => {
            return date?.toFormat('yyyy-MM-dd')
        },
        dateTime: () => {
            return date?.toFormat('yyyy-MM-dd HH:mm')
        },
        time: () => {
            return date?.toFormat('HH:mm')
        }
    }
}

export function polling(callback: () => {}, time: number, rate: number) {
    return new Promise<any>((resolve, reject) => {
        let tentativas = 0
        let interval = setInterval(async () => {
            if (tentativas < 10) {
                try {
                    var result = await callback()
                    if(result){
                        clearInterval(interval)
                        resolve(result)
                    }
                } catch (ex) {
                    tentativas++;
                }
            } else {
                reject()
            }
        }, time)
    })
}

export {
    formatarData,
    timeToDate
}