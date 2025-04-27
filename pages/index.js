import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // 页面加载后立即跳转到 /student-portal
    router.replace('/student-portal');
  }, [router]);

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      justifyContent: 'center', 
      alignItems: 'center', 
      fontSize: '20px' 
    }}>
      Redirecting...
    </div>
  );
}
