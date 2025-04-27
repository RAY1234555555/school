import { v4 as uuidv4 } from 'uuid'

export default function handler(req, res) {
  const state = uuidv4()
  res.setHeader('Set-Cookie', `oauthState=${state}; Path=/; HttpOnly; Secure; SameSite=Lax`)

  const redirectUri = encodeURIComponent(process.env.OAUTH_REDIRECT_URI)
  const authUrl =
    `https://accounts.google.com/o/oauth2/v2/auth` +
    `?client_id=${process.env.CLIENT_ID}` +
    `&response_type=code` +
    `&scope=openid%20email%20profile` +
    `&redirect_uri=${redirectUri}` +
    `&state=${state}` +
    `&access_type=offline` +
    `&prompt=consent`

  res.redirect(authUrl)
}
