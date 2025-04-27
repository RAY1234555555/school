// pages/api/oauth2/initiate.js

import { v4 as uuidv4 } from 'uuid';

export default function handler(req, res) {
  // --- 调试日志开始 ---
  console.log('--- Initiate OAuth Start ---');
  console.log('Received request to initiate OAuth');

  // 读取环境变量 (使用 GOOGLE_CLIENT_ID)
  const clientId = process.env.GOOGLE_CLIENT_ID; // <--- 改回 GOOGLE_CLIENT_ID
  const oauthRedirectUri = process.env.OAUTH_REDIRECT_URI; // 这个保持不变

  // 打印读取到的环境变量值
  console.log('Read GOOGLE_CLIENT_ID:', clientId); // <--- 日志也对应修改
  console.log('Read OAUTH_REDIRECT_URI:', oauthRedirectUri);

  // 检查环境变量是否存在
  if (!clientId || !oauthRedirectUri) {
    console.error('Error: GOOGLE_CLIENT_ID or OAUTH_REDIRECT_URI environment variable is not set.'); // <--- 错误消息也对应修改
    res.status(500).send('Server configuration error.');
    console.log('--- Initiate OAuth End (Error) ---');
    return;
  }

  // 对 Redirect URI 进行编码
  const encodedRedirectUri = encodeURIComponent(oauthRedirectUri);
  console.log('Encoded Redirect URI used:', encodedRedirectUri);

  // 生成 state 参数并设置 cookie
  const state = uuidv4();
  res.setHeader('Set-Cookie', `oauthState=${state}; Path=/; HttpOnly; Secure; SameSite=Lax`);
  console.log('Generated state:', state);

  // 构建 Google 授权 URL (使用 clientId 变量，它现在读取的是 GOOGLE_CLIENT_ID)
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${clientId}` + // 使用 clientId 变量
    `&response_type=code` +
    `&scope=openid%20email%20profile` + // scope 已编码
    `&redirect_uri=${encodedRedirectUri}` +
    `&state=${state}` +
    `&access_type=offline` +
    `&prompt=consent`;

  // 打印最终生成的 URL
  console.log('Generated Auth URL:', authUrl);
  console.log('--- Initiate OAuth End (Redirecting) ---');
  // --- 调试日志结束 ---

  // 重定向用户到 Google
  res.redirect(authUrl);
}
