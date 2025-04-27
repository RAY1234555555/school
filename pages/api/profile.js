import cookie from 'cookie'

export default function handler(req, res) {
  const cookies = cookie.parse(req.headers.cookie || '');

  // 这里模拟生成 profile，实际生产环境可以改成从数据库、OAuth接口获取
  const fullName = cookies.oauthUsername || '测试用户'; // 从Cookie里拿用户名
  const email = cookies.oauthEmail || 'test@example.com'; // 从Cookie里拿邮箱

  // 简单分割姓名示例（如果有更标准化数据源，可以改进）
  const [familyName = '', givenName = ''] = fullName.length > 1 ? [fullName[0], fullName.slice(1)] : ['姓', '名'];

  res.status(200).json({
    name: {
      familyName,
      givenName
    },
    semester: 'Fall 2025',              // 这里可以动态根据情况生成，比如根据时间判断学期
    program: 'Chinese Language Studies', // 默认项目
    student_email: email,
    personal_email: '',                  // 如果有保存个人邮箱，可以填充
    student_id: Math.floor(10000000 + Math.random() * 90000000).toString() // 生成随机8位ID
  });
}
