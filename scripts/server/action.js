/**
 * Copyright (c) 2023 MERCENARIES.AI PTE. LTD.
 * All rights reserved.
 */

const script = {
  name: 'files',

  exec: async function (ctx, payload) {

    if (payload.action == 'make_permanent' && payload.fid)
    {
      let file = await ctx.app.cdn.find(payload.fid, ctx.userId)
      if (file)
      {
        file = await ctx.app.cdn.setExpiry(file, ctx.userId, undefined)
        return {ok: true, file: file}
      }
      else
      {
        console.error("file not found or already permanent", payload.fid)
        return {ok: false, reason : `File ${file.fid}  not found or already permanent`}
      }

    }
    // set expiry for n
    else if (payload.action == 'make_temporary' && payload.fid)
    {
      let file = await ctx.app.cdn.find(payload.fid, ctx.userId)
      console.log(file)
      if (file)
      {
        let expiry = ctx.app.cdn.parseTTL("24h") + Date.now()

        file = await ctx.app.cdn.setExpiry(file, ctx.userId, expiry)
        return {ok: true, file: file, expiry}
      }
      else
      {
        console.error("file not found or already temporary", payload.fid)
        return {ok: false, reason : `File ${file.fid}  not found or already permanent`}
      }

    }


    return        {ok: false, reason: "unknown action"}

  }

}

export default script
