/**
 * Copyright (c) 2023 MERCENARIES.AI PTE. LTD.
 * All rights reserved.
 */

import sharp from 'sharp';
import _ from 'lodash';
import zlib from 'zlib';
import { promisify } from 'util';

const LSB_COUNT = 2
const COMPRESS = true

async function encodeJSONToImage(inputImage, jsonData, n = LSB_COUNT, compress = COMPRESS) {
  const MAGIC_HEADER = Buffer.from('OMNI'); // 4-byte magic header
  const VERSION = Buffer.from([1]); // 1-byte version number

  try {
    console.log("encoding...")
    let binaryJson;
    console.log("Data", JSON.stringify(jsonData.recipe?.activeWorkflow?.meta, null, 2))
    if (compress) {
      const gzipPromise = promisify(zlib.gzip);
      binaryJson = await gzipPromise(JSON.stringify(jsonData));
    } else {
      binaryJson = Buffer.from(JSON.stringify(jsonData));
    }

    const binaryJsonLengthBuffer = Buffer.alloc(4);
    binaryJsonLengthBuffer.writeUInt32BE(binaryJson.length);
    binaryJson = Buffer.concat([MAGIC_HEADER, VERSION, binaryJsonLengthBuffer, binaryJson]);

    // Changes start here
    // Each pixel uses 4 channels, so we need to calculate required pixels accordingly.
    const requiredPixels = Math.ceil(binaryJson.length * 8 / n / 4);
    // Changes end here

    const requiredSize = Math.max(Math.ceil(Math.sqrt(requiredPixels)), 384);

    console.log("requiredSize", requiredSize)

    let resizedImage = await sharp(inputImage.data)
      .resize(requiredSize, requiredSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 1 } })
      .toBuffer();

    let metadata = await sharp(resizedImage).metadata();

    let title = _.escape(jsonData.recipe?.activeWorkflow?.meta?.name || "Omnitool Recipe").substring(0,23)

    const overlay = `<svg width="${metadata.width}" height="${metadata.height}">
    <rect x="0" y="0" width="100%" height="15%" fill="white" />
    <text x="50.4%" y="8.4%" font-family="sans-serif" fill="gray" stroke="gray" strokeWidth="2" dominant-baseline="middle" font-size="25" text-anchor="middle">${title}</text>
    <text x="50%" y="8%" font-family="sans-serif" fill="black" stroke="black" strokeWidth="3" dominant-baseline="middle" font-size="25" text-anchor="middle">${title}</text>
    <text x="72.4%" y="98.4%" font-family="sans-serif" fill="grey" stroke="grey" strokeWidth="2" dominant-baseline="middle" font-size="16" text-anchor="right">omnitool.ai</text>
    <text x="72%" y="98%" font-family="sans-serif" fill="yellow" stroke="yellow" strokeWidth="1" dominant-baseline="middle" font-size="16" text-anchor="right">omnitool.ai</text>
    </svg>`


    const { data, info } = await sharp(resizedImage)
      .composite([{
        input: Buffer.from(overlay),
        gravity: 'center'
      }])
      .png({ compressionLevel: 9, adaptiveFiltering: false, force: true })
      .raw()
      .toBuffer({ resolveWithObject: true });

    const mask = (0xFF << n) & 0xFF;

    // Changes start here
    // Iterate through each pixel (4 channels)
    for (let i = 0; i < binaryJson.length; i++) {
      for (let j = 0; j < 8/n; j++) {
        // Get the pixel and channel we are going to modify
        const index = i * 8/n + j;
        const pixelIndex = Math.floor(index / 4);
        const channelIndex = index % 4;
        const byte = binaryJson[i];
        const channel = byte >> (j * n) & ((1 << n) - 1);
        data[pixelIndex * 4 + channelIndex] = (data[pixelIndex * 4 + channelIndex] & mask) | channel;
      }
    }
    // Changes end here

    return await sharp(data, {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels,
      },
    })
    .png({ compressionLevel: 9, adaptiveFiltering: false, force: true })
    .withMetadata({
      description: binaryJson.toString('base64')  // Store as base64 to ensure it's string-friendly
    })
    .toBuffer();
  } catch (error) {
    console.error(error);
    return null;
  }
}

async function decodeImageToJSON(inputImage, n = LSB_COUNT, compress = COMPRESS) {
  try {


    console.log("decoding...");

    const rawImage = await sharp(inputImage)
      .raw()
      .toBuffer();

    // Changes start here
    // Calculate the binaryJson length according to the number of channels
    let binaryJson = Buffer.alloc(rawImage.length / 4 * n);


    for (let i = 0; i < binaryJson.length; i++) {
      let byte = 0;
      for (let j = 0; j < 8/n; j++) {
        // Get the pixel and channel we are going to read
        const index = i * 8/n + j;
        const pixelIndex = Math.floor(index / 4);
        const channelIndex = index % 4;
        byte |= ((rawImage[pixelIndex * 4 + channelIndex] & ((1 << n) - 1)) << (j * n));
      }
      binaryJson[i] = byte;
    }
    // Changes end here
    const MAGIC_HEADER = Buffer.from('OMNI'); // 4-byte magic header

    if (binaryJson.slice(0, 4).toString() !== MAGIC_HEADER.toString()) {
      throw new Error('Invalid magic header in image.'+ binaryJson.slice(0, 4).toString());
    }

    const version = binaryJson.readUInt8(4);
    console.log("Detected version:", version);
    binaryJson = binaryJson.slice(5);


    const binaryJsonLength = binaryJson.readUInt32BE(0);
    binaryJson = binaryJson.slice(4, 4 + binaryJsonLength);

    let jsonStr;
    if (compress) {
      const gunzipPromise = promisify(zlib.gunzip);
      jsonStr = await gunzipPromise(binaryJson);
    } else {
      jsonStr = binaryJson.toString();
    }

    return JSON.parse(jsonStr);
  } catch (error) {
    try {
      const metadata = await sharp(inputImage).metadata();
      if (metadata.description) {
        const compressedData = Buffer.from(metadata.description, 'base64');
        const gunzipPromise = promisify(zlib.gunzip);
        const jsonStr = await gunzipPromise(compressedData);
        return JSON.parse(jsonStr);
      }
    } catch (metadataError) {
      console.error("Error reading backup from metadata:", metadataError);
    }
    return null;
  }
}

const script = {
  name: 'files',

  exec: async function (ctx, payload) {



    if (payload.action === 'export') {

      try

        let {imageFid, recipe, args} = payload

        imageFid = imageFid.ticket.fid ? imageFid.ticket.fid : imageFid

        if (!imageFid) return {error: 'Image not provided'}
        if (!recipe) return {error: 'Recipe not provided'}
        if (!args) args = {}



        imageFid = {ticket: {fid: imageFid}}

        let image = await ctx.app.cdn.get(imageFid)
        if(!image || !image.data) return {error: 'Image Fid not valid'}

        let result = await encodeJSONToImage(image, {recipe, args})
        if (!result) return {error: 'Error encoding image'}

        let resultImage = await ctx.app.cdn.putTemp(result,{}, {containsRecipe: true, userId: ctx.userId})
        return { ok: true,  image: resultImage }
      }
      catch (ex)
      {
        return {ok: false, reason: ex.message}
      }

    }
    else if (payload.action === 'import')
    {


      let imageFid = payload.imageFid
      if (!imageFid) return {error: 'Image not provided'}

      let image = await ctx.app.cdn.get({ticket: {fid: imageFid}})
      if(!image || !image.data) return {error: 'Image Fid not valid'}

      let result = (await decodeImageToJSON(image.data)).recipe.activeWorkflow
      if (!result) return {error: 'Error decoding image'}

      delete result.id

      console.log(result)
      let file = await ctx.app.cdn.putTemp(Buffer.from(JSON.stringify(result)),{}, {userId: ctx.userId, type: 'recipe'})

      return {file}
    }
    else
    {
      return {error: 'Unknown action' + payload.action}
    }

  }

}

export default script
