import { parse } from 'cookie'

export default function handler(req, res) {
  const cookies = parse(req.headers.cookie || '')
  const username = cookies.oauthUsername || ''
  const fullName = cookies.oauthFullName || ''
  const userId = cookies.oauthUserId || ''

  res.status(200).json({
    username,
    fullName,
    userId
  })
}
