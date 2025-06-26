// import type { IronSession } from 'iron-session'; // No longer needed here directly for extends

// SessionData defines the properties you want to store in the session.
// The IronSession type will be applied by getIronSession, adding methods like save(), destroy() etc.
export interface SessionData {
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
