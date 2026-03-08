'use strict';

const { Readable } = require('stream');
const { PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const { putJson, getJson, withPrefix, streamToString } = require('../src/services/s3Service');

describe('s3Service', () => {
  test('withPrefix applies optional prefix', () => {
    expect(withPrefix('', 'a.json')).toBe('a.json');
    expect(withPrefix('p', 'a.json')).toBe('p/a.json');
    expect(withPrefix('p/', 'a.json')).toBe('p/a.json');
  });

  test('putJson sends PutObjectCommand', async () => {
    const client = { send: jest.fn().mockResolvedValue({}) };
    const data = { hello: 'world' };

    const key = await putJson(client, 'bucket', 'k.json', data, 'prefix');

    expect(key).toBe('prefix/k.json');
    expect(client.send).toHaveBeenCalledTimes(1);
    const command = client.send.mock.calls[0][0];
    expect(command).toBeInstanceOf(PutObjectCommand);
    expect(command.input).toMatchObject({
      Bucket: 'bucket',
      Key: 'prefix/k.json',
      ContentType: 'application/json'
    });
    expect(command.input.Body).toBe(JSON.stringify(data));
  });

  test('getJson returns parsed object for transformToString body', async () => {
    const client = {
      send: jest.fn().mockResolvedValue({
        Body: {
          transformToString: jest.fn().mockResolvedValue('{"x":1}')
        }
      })
    };

    const result = await getJson(client, 'bucket', 'k.json', 'prefix');

    expect(result).toEqual({
      key: 'prefix/k.json',
      data: { x: 1 }
    });
    const command = client.send.mock.calls[0][0];
    expect(command).toBeInstanceOf(GetObjectCommand);
  });

  test('getJson maps NoSuchKey to NOT_FOUND', async () => {
    const error = new Error('No such key');
    error.name = 'NoSuchKey';
    const client = { send: jest.fn().mockRejectedValue(error) };

    await expect(getJson(client, 'bucket', 'missing.json')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  test('getJson maps NoSuchBucket to BUCKET_NOT_FOUND', async () => {
    const error = new Error('No such bucket');
    error.name = 'NoSuchBucket';
    const client = { send: jest.fn().mockRejectedValue(error) };

    await expect(getJson(client, 'missing-bucket', 'a.json')).rejects.toMatchObject({ code: 'BUCKET_NOT_FOUND' });
  });

  test('streamToString handles node stream body', async () => {
    const body = Readable.from(['{"a":', '2}']);
    await expect(streamToString(body)).resolves.toBe('{"a":2}');
  });
});
