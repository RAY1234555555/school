import cookie from 'cookie'

export default function handler(req, res) {
  res.setHeader('Set-Cookie', [
    cookie.serialize('oauthUsername', '', { path: '/', expires: new Date(0) }),
    cookie.serialize('oauthUserId', '', { path: '/', expires: new Date(0) }),
    cookie.serialize('oauthEmail', '', { path: '/', expires: new Date(0) }),
    cookie.serialize('oauthTrustLevel', '', { path: '/', expires: new Date(0) }),
  ])
  res.redirect('/')
}
