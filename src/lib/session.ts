import type { IronSessionData } from 'iron-session';

export interface SessionData extends IronSessionData {
  username?: string;
  isLoggedIn: boolean;
}

export const sessionOptions = {
  cookieName: 'propscrapeai_session',
  password: process.env.IRON_SESSION_SECRET as string,
  cookieOptions: {
    secure: process.env.NODE_ENV === 'production',
  },
};
