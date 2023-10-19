/**
 * Copyright (c) 2023 MERCENARIES.AI PTE. LTD.
 * All rights reserved.
 */

const script = {
  name: 'files',

  exec: async function (ctx, payload) {

    console.log("-----files", payload)
    let limit = payload.limit || 50
    let cursor = payload.cursor || undefined
    let expiryType = payload.expiryType

    let owner = {
      user: ctx.userId.toLowerCase(),
      includeUnowned: payload.includeUnowned ?? true
    }
    let files =  ctx.app.cdn.kvStorage.getAny('file.',undefined,{limit,cursor, expiryType, owner}).map((file) => {

      if (file.value.fid)
      {
        file.value.url = '/fid/' + file.value.fid
      }
      if (file.value.expires >= Number.MAX_SAFE_INTEGER)
      {
        delete file.value.expires
      }
      console.log(file.tags)
      return {...file.value, seq: file.seq, tags: file.tags.map((tag) => tag.replace('#tag.', '') ||[] ) }
    })


    return {
      images:files
    }
  }

}

export default script
