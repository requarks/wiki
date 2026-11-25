import { assetContentUrl, assetUrl } from './assets.js'

const PICKERS = {
  include: { path: 'page' },
  index: { path: 'folder' },
  infobox: { image: 'asset' },
  'media-player': { src: 'asset' },
  pdf: { src: 'asset' },
  asciinema: { src: 'asset' }
}

export function blockPickerType(block, field) {
  return PICKERS[block]?.[field]
}

export function blockPickValues(type, field, item, { siteId, primaryLocale, localeLocked }) {
  if (type === 'folder') {
    return { [field]: item.folderPath }
  }
  if (type === 'page') {
    return {
      [field]: [item.folderPath, item.fileName].filter(Boolean).join('/'),
      ...(!localeLocked ? { locale: item.locale } : {})
    }
  }
  if (type === 'asset') {
    return {
      [field]:
        item.locale === primaryLocale
          ? assetUrl(item.folderPath, item.fileName)
          : assetContentUrl(siteId, item.id)
    }
  }
  throw new Error(`Unknown block picker type: ${type}`)
}
