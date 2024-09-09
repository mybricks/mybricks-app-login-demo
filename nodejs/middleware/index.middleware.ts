

interface MiddlewareContext {
  UserModel: {
    /** 查询当前用户信息 */
    query: ({ email }: { email: string }) => Promise<UserInfo | void>
    /** 新增用户 */
    create: (user: UserInfo) => Promise<void>
  },
  /** 将用户信息注入上下文 */
  setUser: (request, { email }) => void
  /** 日志方法 */
  Logger: Record<'info' | 'error', (message: string) => void>
}

interface UserInfo {
  /** 用户名，会显示在系统中 */
  name: string
  /** 头像的http链接 */
  avatar?: string
  /** 邮箱，作为 myBricks 系统中的用户唯一凭证，如果没有邮箱可以用用户ID等唯一凭证也可以 */
  email: string,
  /** 用户角色 */
  role?: UserRole
}


/** 需要鉴权的 获取用户信息 的接口列表 */
const NEED_AUTH_PATHES = ['/paas/api/user/signed', '/paas/api/user/queryCurrentSession']

enum UserRole {
  NORMAL = 2, // 普通用户
  ADMIN = 10 // 超管
}

export default function registerUser({ UserModel, setUser, Logger }: MiddlewareContext) {
  return async function (request, response, next) {
    if(NEED_AUTH_PATHES.includes(request.path)) {
      try {
        // 获取到的目标用户信息
        let userInfo: UserInfo | null = null;

        // 方式一，从 http cookie 中获取用户信息
        const cookieInfo = request?.cookies?.['目标cookie的key'];
        userInfo = JSON.parse(cookieInfo); // 假设用户信息以json方式存储

        // 方式二，从 http header 中获取用户信息
        const headerValue = request?.headers?.['目标header的key'];
        function jwtVerify (v) {return v}
        userInfo = jwtVerify(headerValue)?.payload; // 假设用户信息以jsonwebtoken的形式存储

        // 如果没获取到用户信息，可以直接返回，此时会提示用户进行登录
        if (!userInfo) {
          return next();
        }

        const name = userInfo.name;
        const avatar = userInfo.avatar ?? '/default_avatar.png';
        const email = userInfo.email;
  
        // 查询用户是否存在
        const user = await UserModel.query({
          email,
        });
  
        // 不存在，则注册新用户
        if (!user) {
          await UserModel.create({
            name,
            email,
            avatar,
            role: userInfo?.isAdmin ? UserRole.ADMIN : UserRole.NORMAL
          });
        }

        // 将用户信息注入 Mybricks 平台
        setUser(request, { email })
      } catch (error) {
        Logger.error(error?.stack ?? '未知错误')
      }
    }
    next();
  };
}