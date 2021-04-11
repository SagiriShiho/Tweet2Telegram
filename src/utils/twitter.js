require('dotenv').config()
const { TwitterClient } = require('twitter-api-client')
const consola = require('consola')
const twitterClient = new TwitterClient({
    apiKey: process.env.TWITTER_API_KEY,
    apiSecret: process.env.TWITTER_API_SECRET,
    accessToken: process.env.TWITTER_ACCESS_TOKEN,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECERT
});

const constructTweetLink = (id, username) => {
    return `https://twitter.com/${username}/status/${id}`
}

const constructProfileLink = (username) => {
    return `https://twitter.com/${username}`
}

const convertMediaToTelegram = (ctx) => {
    if (ctx && ctx.media && ctx.media.length !== 0) {
        return ctx.media.map(e => {
            if (e.type === 'video' || e.type === 'animated_gif') {
                const supportedMaxRate = e.video_info.variants.reduce((next, current) => {
                    if (next.context_type !== 'video/mp4') {
                        return current
                    } 
                    if (next.bitrate) {
                        if (current && current.bitrate) {
                            return next.bitrate > current.bitrate ? next : current
                        }
                        return next
                    }
                    return current
                })
                return {
                    type: 'video',
                    media: supportedMaxRate.url
                }
            }

            return {
                media: `${e.media_url_https}?name=large`,
                type: e.type
            }
        })
    }
    return []
}

const revertLinks = (formatted, originalLinks) => {
    originalLinks.forEach(e => {
        formatted = formatted.replace(e.url, e.expanded_url)
    })

    // Remove all extra link
    const twitterLinkRegex = /https:\/\/t\.co\/[a-zA-Z0-9]{10}/g
    const links = formatted.match(twitterLinkRegex) || []
    links.forEach(e => {
        formatted = formatted.replace(e, '')
    })
    
    return formatted
}

const replaceMentionedUser = (formatted, listOfMentions) => {
    listOfMentions.forEach(e => {
        formatted = formatted.replace(`@${e.screen_name}`, `<a href="${constructProfileLink(e.screen_name)}">@${e.screen_name}</a>`)
    })

    return formatted
}

const formatText = (str, tweet) => {
    let formatted = str
    formatted = revertLinks(formatted, tweet.entities.urls)
    formatted = replaceMentionedUser(formatted, tweet.entities.user_mentions)

    return formatted
}

const getAllLikesSince = async () => {
    const content = await twitterClient.tweets.favoritesList({ 
        // Limit to 100, It is concerned that Twitter has some bug with the 
        // number of tweets here. see #2
        count: 200,
        tweet_mode: 'extended'
    })
    return content.map(e => {
        return {
            id: e.id_str,
            link: constructTweetLink(e.id_str, e.user.screen_name),
            media: convertMediaToTelegram(e.extended_entities),
            user: {
                username: e.user.screen_name,
                link: constructProfileLink(e.user.screen_name)
            },
            text: formatText(e.full_text, e),
            nsfw: e.possibly_sensitive
        }
    })
}

module.exports = {
    getAllLikesSince
}
