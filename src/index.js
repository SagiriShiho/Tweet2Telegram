require('dotenv').config()
const consola = require('consola')

const channelID = process.env.TELEGRAM_CHATID
const Telegram = require('telegraf/telegram')
const bot = new Telegram(process.env.TELEGRAM_CHANNELBOT)

const { getAllLikesSince, getLatestLikeId } = require('./utils/twitter')
const { writeData, readData } = require('./utils/io') 
const { RateLimit } = require('async-sema');
const lim = RateLimit(7, { timeUnit: '60000' })

// Telegram allow 30 message/s, channel however, said 20 message / minute
// This slow down the process, as each tweet can have upto 4 message so each time it is safe to process
// ~5 tweet/minutes
const main = async (since_id) => {
    consola.info("main: since_id:", since_id)
    const likes = await getAllLikesSince(since_id)
    const messages = []
    // We cannot do map: we need rate limits
    for (const tweet of likes) {
        consola.info('tweet for: ', tweet)
        const template = `${tweet.text}

<a href="${tweet.link}">Tweet</a> by <a href="${tweet.user.link}">@${tweet.user.username}</a> ${tweet.nsfw ? '#possiblyNSFW' : ''}`
        if (tweet.media.length !== 0) {
            // we need to double check if type are matched: video only or image only
            let mediaGroup = tweet.media
            const v = tweet.media.filter(e => e.type === 'video')
            if (v.length > 0) {
                mediaGroup = v
            }
            mediaGroup[0] = {
                caption: template,
                parse_mode: 'html',
                ...mediaGroup[0]
            }
            consola.info('build message: ', mediaGroup)

            await lim()
            messages.push(bot.sendMediaGroup(channelID, mediaGroup))
            continue
        }

        await lim()
        messages.push(bot.sendMessage(channelID, template, {
            parse_mode: 'html'
        }))
    }

    return Promise.all(messages)
}

const reset = async () => {
    const res = await getLatestLikeId().catch(e => {
        consola.error(e)
    })
    const d =  { since_id: res }
    writeData(d)
    consola.success('finished update')
}

readData().then(res => {
    consola.info('data read: ', res)
    if (res && res.since_id) {
        reset() // we issue the update first, to avoid duplicate actions from dispatch and overlap
        main(res.since_id).then(() => {
            consola.success('finished processed')
        }).catch(e => {
            consola.error(e)
        })
    } else {
        consola.info('first time access detected')
        reset()
    }
}).catch(e => {
    consola.error(e)
})

