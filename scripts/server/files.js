/**
 * Copyright (c) 2023 MERCENARIES.AI PTE. LTD.
 * All rights reserved.
 */

const script = {
  name: 'files',

  exec: async function (ctx, payload) {


    let limit = payload.limit || 50
    let cursor = payload.cursor || undefined
    let expiryType = payload.expiryType
    let tags = payload.tags

    let owner = {
      user: ctx.userId.toLowerCase(),
      includeUnowned: payload.includeUnowned ?? true
    }
    let files = await Promise.all(ctx.app.cdn.kvStorage.getAny('file.',undefined,{limit,cursor, expiryType, owner, tags}).map(async (file) => {
      if (file.value.data)
      {
        // hot fix to remove data that snuck in there because of the setexpiry bug
        delete file.value.data;
        await ctx.app.cdn.updateFileEntry(file.value)
      }
      if (file.value.fid)
      {
        file.value.url = '/fid/' + file.value.fid
      }
      if (file.value.expires >= Number.MAX_SAFE_INTEGER)
      {
        delete file.value.expires
      }

      return {...file.value, seq: file.seq, tags: file.tags.map((tag) => tag.replace('#tag.', '') ||[] ) }
    })
    );
    return {
      files:files
    }
  }

}

export default script
