import express, { NextFunction, Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import morgan from 'morgan';
import path from 'path';
import mongoose, { Error } from 'mongoose';
import cors from 'cors';
import passport from 'passport';
import { IVerifyOptions } from 'passport-local';
import cookieSession from 'cookie-session';
import config from 'config';

import User from './models/users.model';

import authMiddlewares from './middlewares/auth';

dotenv.config();

const app = express();
const origin = process.env.ORIGIN;
app.use(cors({ origin, credentials: true }));
app.use('/static', express.static(path.join(__dirname, 'public')));

// session cookie에 저장
app.use(
  cookieSession({
    name: 'OAuth',
    maxAge: 1209600000,
    keys: [`${process.env.COOKIE_ENCRYPTION_KEY}`],
  })
);

// req.session.regenerate is not a function using passport 0.6.0
app.use((request, response, next) => {
  if (request.session && !request.session.regenerate) {
    request.session.regenerate = (cb: any) => {
      cb();
    };
  }
  if (request.session && !request.session.save) {
    request.session.save = (cb: any) => {
      cb();
    };
  }
  next();
});

app.use(passport.initialize());
app.use(passport.session());
require('./config/passport');

app.use(express.json());
app.use(express.urlencoded({ extended: false })); // form태그 내용 받으려면
app.use(cookieParser());
app.use(morgan('dev'));

// mongodb 연결
mongoose
  .connect(`${process.env.MONGO_URI}`)
  .then(() => console.log('mongodb connected!'))
  .catch((err: Error) => {
    console.error(err);
  });

app.get('/', authMiddlewares.checkAuthenticated, (req, res) => {
  res.send('server is running!');
});

// 회원가입
app.post('/signup', authMiddlewares.checkNotAuthenticated, async (req: Request, res: Response, next: NextFunction) => {
  console.log('123');

  const user = new User(req.body);
  console.log('req.body>>>', req.body);

  try {
    await user.save();
    res.redirect('http://localhost:3000/login');
  } catch (err) {
    console.error(err);
  }
});

// 구글 로그인
app.get('/auth/google', passport.authenticate('google'));
app.get(
  '/auth/google/callback',
  passport.authenticate('google', {
    successReturnToOrRedirect: 'http://localhost:3000',
    failureRedirect: 'http://localhost:3000/login',
  })
);

// 로그인
app.post('/login', authMiddlewares.checkNotAuthenticated, (req: Request, res: Response, next: NextFunction) => {
  // 콜백부분 -> passport.ts
  passport.authenticate('local', (err: any, user: any, info: IVerifyOptions) => {
    if (err) return next(err);

    if (!user) {
      console.log('no user found');
      return res.json({ message: info });
    }

    // 여기서 세션 생성
    // req.user = user
    req.logIn(user, (err) => {
      if (err) return next(err);
      console.log('123');

      res.redirect('http://localhost:3000');
    });
  })(req, res, next);
});

app.post('/logout', (req: Request, res: Response, next: NextFunction) => {
  req.logOut((err) => {
    if (err) return next(err);

    return res.status(200).json({ message: 'logout success' });
  });
});

const serverConfig = config.get<any>('server');

app.listen(serverConfig.port, async () => {
  console.log(`Server is running on ${serverConfig.port}`);
});
