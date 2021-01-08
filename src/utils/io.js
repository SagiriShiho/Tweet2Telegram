require('dotenv').config()
const Gists = require('gists')
const gists = new Gists({ token: process.env.GIST_TOKEN })
const consola = require('consola')

const gistId = process.env.GIST_ID
const gistFile = process.env.GIST_FILE || 'data.json'

const readData = async () => {
    consola.info('fetch data from gist: ', gistId)
    return gists.get(gistId).then(res => {
        return JSON.parse(res.body.files[gistFile].content)
    })
}

const writeData = async(data) => {
    let update = { files: {} }
    update.files[gistFile] = {
        content: JSON.stringify(data, null, 2)
    }
    consola.info('updated: ', update)
    return gists.edit(gistId, update)
}

module.exports = {
    writeData,
    readData
}
