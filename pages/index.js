import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/student-portal'); // 登录主入口
  }, [router]);

  return null;
}
