import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import axios from 'axios';

export default function StudentPortal() {
  const router = useRouter();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchProfile() {
      try {
        const response = await axios.get('/api/profile');
        setProfile(response.data);
      } catch (err) {
        setError('无法加载学生信息，请稍后再试。');
      } finally {
        setLoading(false);
      }
    }
    fetchProfile();
  }, []);

  const handleDelete = async () => {
    if (!confirm('确认要删除账户吗？此操作不可撤销。')) return;
    router.push('/api/logout');
  };

  if (loading) return <div style={{ textAlign: 'center', marginTop: '50px' }}>加载中...</div>;
  if (error) return <div style={{ color: 'red', textAlign: 'center', marginTop: '50px' }}>{error}</div>;

  const gmailLink = profile.student_email
    ? `https://mail.google.com/a/${profile.student_email.split('@')[1]}?Email=${encodeURIComponent(profile.student_email)}`
    : '#';

  return (
    <>
      <Head>
        <title>孔子学院学生门户</title>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
      </Head>

      <div className="portal-container">
        <header className="portal-header">
          <img src="https://kzxy.edu.kg/static/themes/default/images/indexImg/logo-20th.png" alt="Confucius Logo" className="logo" />
          <h1>孔子学院学生门户</h1>
          <h2>Confucius Institute Student Portal</h2>
        </header>

        <section className="profile-section card">
          <h3><i className="fas fa-user-circle"></i> 学生信息</h3>
          <div className="profile-details">
            <p><strong>姓名:</strong> <span>{`${profile.name.familyName} ${profile.name.givenName}`}</span></p>
            <p><strong>学期:</strong> <span>{profile.semester}</span></p>
            <p><strong>项目:</strong> <span>{profile.program}</span></p>
            <p><strong>学生邮箱:</strong> <span>{profile.student_email}</span></p>
            {profile.personal_email && <p><strong>个人邮箱:</strong> <span>{profile.personal_email}</span></p>}
            <p><strong>学生ID:</strong> <span>{profile.student_id}</span></p>
          </div>
        </section>

        <section className="actions-section card">
          <h3><i className="fas fa-th-large"></i> 快速访问</h3>
          <div className="actions-grid">
            <a href={gmailLink} className="action-button email" target="_blank" rel="noopener noreferrer">
              <i className="fas fa-envelope"></i>
              <span>学生邮箱</span>
            </a>
            <Link href="/student-card" legacyBehavior>
              <a className="action-button card"><i className="fas fa-id-card"></i><span>电子学生卡</span></a>
            </Link>
            <a href="https://account.adobe.com/" className="action-button adobe" target="_blank" rel="noopener noreferrer">
              <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/1/1c/Adobe_Express_logo_RGB_1024px.png/500px-Adobe_Express_logo_RGB_1024px.png" alt="Adobe Express" style={{ width: 28, height: 28 }} />
              <span>Adobe Express</span>
            </a>
            <Link href="/transcript" legacyBehavior>
              <a className="action-button transcript"><i className="fas fa-file-alt"></i><span>成绩单</span></a>
            </Link>
            <a href="https://www.canva.com/login" className="action-button canva" target="_blank" rel="noopener noreferrer">
              <i className="fas fa-palette"></i><span>Canva</span>
            </a>
            <Link href="/reset-password" legacyBehavior>
              <a className="action-button password"><i className="fas fa-key"></i><span>重置密码</span></a>
            </Link>
            <Link href="/aliases" legacyBehavior>
              <a className="action-button aliases"><i className="fas fa-plus-circle"></i><span>添加邮箱别名</span></a>
            </Link>
          </div>
        </section>

        <footer className="portal-footer">
          <div className="footer-buttons">
            <form action="/api/logout" method="POST">
              <button type="submit" className="logout-button">
                <i className="fas fa-sign-out-alt"></i> 登出
              </button>
            </form>
            <button className="delete-button" onClick={handleDelete}>
              <i className="fas fa-trash-alt"></i> 删除账户
            </button>
          </div>
          <div className="footer-text">
            孔子学院学生服务 | Confucius Institute Student Services | Powered by{' '}
            <a href="https://kzxy.edu.kg" target="_blank" rel="noopener noreferrer">kzxy.edu.kg</a>
          </div>
        </footer>
      </div>

      <style jsx>{`
        .portal-container { max-width: 1000px; margin: 20px auto; padding: 30px; background: white; border-radius: 16px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); }
        .portal-header, .portal-footer { text-align: center; }
        .logo { width: 90px; height: auto; margin-bottom: 10px; }
        .card { padding: 20px; background: #f9f9f9; border-radius: 12px; margin-bottom: 20px; }
        .profile-details p, .actions-grid a { background: #fff; padding: 10px; border-radius: 8px; margin-bottom: 10px; display: flex; justify-content: space-between; align-items: center; min-height: 50px; }
        .actions-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 15px; }
        .action-button { flex-direction: column; text-align: center; font-weight: bold; min-height: 130px; justify-content: center; }
        .logout-button, .delete-button { margin: 10px; padding: 10px 20px; border-radius: 8px; border: none; cursor: pointer; }
        .logout-button { background: red; color: white; }
        .delete-button { background: gray; color: white; }
        .footer-text { font-size: 12px; margin-top: 10px; }
      `}</style>
    </>
  );
}
