/**
 * Copyright (c) 2023 MERCENARIES.AI PTE. LTD.
 * All rights reserved.
 */


const script = {
  name: 'delete',

  exec: async function (ctx, payload) {


    console.log('delete', payload)

    if (payload == null) {
        return {ok: false , reason: 'No payload'};
    }

    if (payload.delete == null){
      return {ok: false, reason: 'No delete property'};
    }

    if (!Array.isArray(payload.delete)){
      return {ok: false, reason: 'Not an array'};
    }

    payload.delete = payload.delete.map((fid) => {
      if (typeof(fid) === 'string'){
        return fid
      }
      if (typeof(fid) === 'object' && fid.ticket != null && fid.ticket.fid != null){
        return fid.ticket.fid
      }
      return null
    }).filter((fid) => fid != null)



    await Promise.all(payload.delete.map(fid=> {
      console.log('softDelete')
      ctx.app.cdn.softDelete(fid, )
    }))

    return {
      deleted: payload.delete,
      ok: true
    }
  }

}

export default script
