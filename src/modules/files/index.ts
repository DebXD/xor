import { Api } from 'telegram'
import { CustomFile } from 'telegram/client/uploads'
import fs from 'fs/promises'
import { constants } from 'fs'
import { join } from 'path'

import { CommandHandler } from '../../handlers'
import { Module } from '../../module'
import { updateMessage } from '../../helpers'
import { parseAttributes } from './helpers'

const files: Module = {
	name: 'files',
	handlers: [
		new CommandHandler(
			'download',
			async (client, event) => {
				const media = (await event.message.getReplyMessage())?.media
				if (!media) {
					await updateMessage(event, 'Reply a file to download.')
					return
				}
				let filename = ''
				if (media instanceof Api.MessageMediaPhoto) {
					filename = 'photo_' + media.photo?.id.toString() + '.png'
				}
				if (
					media instanceof Api.MessageMediaDocument &&
					!(media instanceof Api.MessageMediaEmpty) &&
					media.document &&
					!(media.document instanceof Api.DocumentEmpty)
				) {
					const { attrFilename } = parseAttributes(media.document.attributes)
					if (attrFilename) {
						filename = attrFilename.fileName
					} else {
						const mime = media.document.mimeType
						if (mime.includes('video')) {
							filename = 'video_' + media.document.id + '.' + mime.split('/')[1]
						}
						if (mime.includes('audio')) {
							filename = 'audio' + media.document.id + '.' + mime.split('/')[1]
						}
					}
				}
				await updateMessage(event, 'Downloading...')
				const mediaBuffer = await client.downloadMedia(media, {})
				const spec = join('downloads', filename)
				await fs.mkdir(join('downloads'), { recursive: true })
				await fs.writeFile(spec, mediaBuffer)
				await updateMessage(
					event,
					'Downloaded to <code>./downloads/' + filename + '</code>.',
					'html'
				)
			},
			{ aliases: ['dl'] }
		),
		new CommandHandler(
			'upload',
			async (client, event, args) => {
				if (!args || !args.length) {
					await event.message.edit({
						text: event.message.text + '\nProvide a file path to upload.'
					})
					return
				}
				const filePath = join(process.cwd(), args[0])
				const forceDocument = args[1] ? args[1] === 'true' : true
				try {
					await fs.access(filePath, constants.R_OK)
				} catch (e) {
					await updateMessage(
						event,
						`File not found or access denied (<code>${e}</code>).`,
						'html'
					)
					return
				}
				if (!event.chatId) {
					return
				}
				await updateMessage(event, 'Uploading...')
				await client.sendFile(event.chatId, {
					file: filePath,
					forceDocument
				})
				await updateMessage(event, 'Uploaded.')
			},
			{ aliases: ['ul'] }
		),
		new CommandHandler(
			'rnupload',
			async (client, event, args) => {
				if (!args || !args.length) {
					await updateMessage(event, 'Provide a new name.')
					return
				}
				const media = (await event.message.getReplyMessage())?.media
				if (!media) {
					await updateMessage(event, 'Reply a file to download.')
					return
				}
				if (!event.chatId) {
					return
				}
				await updateMessage(event, 'Downloading...')
				const mediaBuffer = await client.downloadMedia(media, {})
				await updateMessage(event, 'Uploading...')
				await client.sendFile(event.chatId, {
					file: new CustomFile(args[0], mediaBuffer.length, '', mediaBuffer),
					forceDocument: true
				})
				await updateMessage(event, `Renamed to ${args[0]}.`)
			},
			{ aliases: ['rnul'] }
		),
		new CommandHandler(
			'listdl',
			async (_client, event) => {
				const files = await fs.readdir(join(process.cwd(), 'downloads'))
				await updateMessage(
					event,
					files.map(file => `\n- <code>${file}</code>`).join(''),
					'html'
				)
			},
			{
				aliases: ['lsdl']
			}
		)
	],
	help: `
**Introduction**

The files module can be used for operations like file download, upload, listing and more.

**Commands**

- download, dl

Downloads the replied file or media.

- upload, ul

Uploads a local file to Telegram.

- rnupload, rnul

Re-uploads the replied file to Telegram with a new name.

- listdl, lsdl

Lists the downloaded files.
`
}

export default files