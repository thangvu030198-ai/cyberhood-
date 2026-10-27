// Cấu hình khi tự host website (server Ubuntu / CDN). Để trống trường nào thì dùng giá trị mặc định trong site.js.
window.CH_CONFIG = {
  // gameUrl: 'https://play.cyberhood.space',
  // siteUrl: 'https://cyberhood.space',
  xHandle: 'Cyberhoodlabs',
  // Máy viết bài X theo chủ đề (deploy/post-ai, key OpenAI nằm trên server). Bỏ trống = AI có sẵn / văn mẫu
  aiEndpoint: '/api/post',
  // Đăng ký Early Access lưu trên server (deploy/signups), xem ở /admin
  signupEndpoint: '/api/signup',
};
