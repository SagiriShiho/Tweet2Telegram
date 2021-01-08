require('dotenv').config()
const consola = require('consola')

const channelID = process.env.TELEGRAM_CHATID
const Telegram = require('telegraf/telegram')
const bot = new Telegram(process.env.TELEGRAM_CHANNELBOT)

const { getAllLikesSince, getLatestLikeId } = require('./utils/twitter')
const { writeData, readData } = require('./utils/io') 
const { RateLimit } = require('async-sema');
const lim = RateLimit(5, { timeUnit: '60000', uniformDistribution: true})

// Telegram allow 30 message/s, channel however, said 20 message / minute
// This slow down the process, as each tweet can have upto 4 message so each time it is safe to process
// ~5 tweet/minutes
const main = async (prev_ids, likes) => {
    consola.info("main: since_id:", prev_ids)

    const messages = []
    // We cannot do map: we need rate limits
    for (const tweet of likes) {
        if (prev_ids.includes(tweet.id)) {
            consola.info('tweet id skipped: ', tweet.id)
            continue // skip this id, sent
        }

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

    return messages
}

const update = async (prev_ids, ids) => {
    if (prev_ids.length === ids.length && prev_ids.every(function(value, index) { return value === ids[index]})) {
        consola.success('no update required')
        return
    } else {
        const d =  { since_id: ids }
        await writeData(d)
        consola.success('finished update')
    }
}

readData().then(res => {
    consola.info('data read: ', res)
    if (res && res.since_id) {
        const prev_ids = res.since_id
        getAllLikesSince().then(likes => {
            const ids = likes.map(e => {
                return e.id
            })
            update(prev_ids, ids)// we issue the update first, to avoid duplicate actions from dispatch and overlap
            main(prev_ids, likes).then(() => {
                consola.success('finished processed')
            }).catch(e => {
                consola.error(e)
            })
        }).catch(e => {
            consola.error(e)
        })
    } else {
        consola.info('first time access detected')
        getAllLikesSince().then(likes => {
            const ids = likes.map(e => {
                return e.id
            })
            update([], ids)// we issue the update first, to avoid duplicate actions from dispatch and overlap
        }).catch(e => {
            consola.error(e)
        })
    }
}).catch(e => {
    consola.error(e)
})

