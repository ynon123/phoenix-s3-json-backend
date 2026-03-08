'use strict';

jest.mock('../src/config/env', () => ({
  getConfig: jest.fn(() => ({ region: 'us-east-1', bucket: 'my-bucket', prefix: 'p' }))
}));

jest.mock('../src/services/s3Service', () => ({
  createS3Client: jest.fn(() => ({ client: true })),
  putJson: jest.fn()
}));

const { handler } = require('../src/handlers/postJson');
const s3Service = require('../src/services/s3Service');

describe('postJson handler', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('returns 200 and upload result for valid payload', async () => {
    s3Service.putJson.mockResolvedValue('p/file.json');

    const event = {
      path: '/json/file.json',
      httpMethod: 'POST',
      pathParameters: { key: 'file.json' },
      body: '{"ok":true}'
    };

    const result = await handler(event, { awsRequestId: 'req-1' });

    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body)).toEqual({ key: 'p/file.json', bucket: 'my-bucket' });
    expect(s3Service.putJson).toHaveBeenCalledWith(
      { client: true },
      'my-bucket',
      'file.json',
      { ok: true },
      'p'
    );
  });

  test('returns 400 when body is invalid json', async () => {
    const result = await handler(
      {
        path: '/json/file.json',
        httpMethod: 'POST',
        pathParameters: { key: 'file.json' },
        body: '{invalid}'
      },
      { awsRequestId: 'req-2' }
    );

    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body)).toEqual({ message: 'Invalid JSON body' });
  });

  test('returns 400 when key path param missing', async () => {
    const result = await handler({ body: '{"a":1}' }, { awsRequestId: 'req-3' });
    expect(result.statusCode).toBe(400);
  });
});
