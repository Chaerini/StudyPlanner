// Express 라이브러리 사용
const express = require('express');

// Express 애플리케이션 생성
const app = express();

// dotenv 사용 ( .env 파일 사용하기 위함 )
require('dotenv').config()

// bcrypt 사용 ( 패스워드 암호화 사용하기 위함 )
const bcrypt = require('bcrypt')

// JWT 토큰, 쿠키 패키지 사용
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');

const secretKey = process.env.secretKey;

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());

// 업로드 폴더 생성
const multer = require('multer');
const fs = require('fs');
const path = require('path');

// uploads 폴더가 없으면 생성하기
const uploadDir = 'uploads';
if(!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

// 정적 파일 제공 설정
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 업로드 파일 저장 위치와 파일 이름 설정
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        cb(null, `${Date.now()}-${file.originalname}`);
    }
});

const upload = multer({ storage: storage });

// mongoDB 연결
const { MongoClient, ObjectId } = require('mongodb');
let db;
// const url = `mongodb+srv://admin:admin@cluster0.xbutcnk.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const url = process.env.DB_URL;

new MongoClient(url).connect().then((client) => {
    console.log('DB연결성공')
    db = client.db('study');
}).catch((err) => {
    console.log(err);
})

// 서버를 8080포트에서 실행
app.listen(process.env.PORT, () => {
    console.log('http://localhost:8080 에서 서버 실행중');
});

const methodOverride = require('method-override');
app.use(methodOverride('_method'))

// Express에 클라이언트가 요청할 수 있는 정적 파일을 제공
app.use(express.static(__dirname+'/public'));

// ejs 사용
app.set('view engine', 'ejs');

// 글 작성 기능
app.use(express.json());
app.use(express.urlencoded({extended:true}));

// 루트 경로에 대한 GET 요청 처리
app.get('/', async (req, res) => {
    let date = req.body.date;
    // console.log("date1: "+date);

    if(!date) {
        currentDate = new Date().toISOString().split('T')[0];
        // console.log("date2: "+currentDate);
        date = currentDate;
    }

    let result = await db.collection('post').find().toArray();
    let todoresult = await db.collection('todo').find().toArray();
    let userresult;

    console.log(result);
    
    const token = req.cookies.auth_token;

    // 토큰이 있을 경우
    if(token) {
        // jwt토큰을 해석
        jwt.verify(token, secretKey, async (err, decoded) => {
            if(err) {
                return res.redirect('/login');
            } else {
                // id 가져오기
                const userId = decoded.id;
                userresult = await db.collection('user').findOne({ _id: new ObjectId(userId) });
                console.log("user: "+userresult.imgurl);
                res.render('main.ejs', { posts: result, todos: todoresult, userresult: userresult });
            }
        })
    } else {
        return res.redirect('/login');
    }
    
    
});

// 현재 날짜 반환
app.get('/date/:date?', async (req, res) => {
    let date = req.query.date;
    if(!date) {
        console.log('날짜 선택을 하지 않았습니다.');
        res.status(400).send('날짜 선택을 하지 않았습니다.');
    } else {
        console.log("date: "+date);

        let result = await db.collection('post').find({ date: date }).toArray();
        let todoresult = await db.collection('todo').find({ date: date }).toArray();
        console.log(result);

        res.render('main.ejs', { posts: result, todos: todoresult });
    }
})

// 작성페이지 만들기
app.get('/write', (req, res) => {
    res.render('write.ejs')
});

app.post('/add', async(req, res) => {
    console.log(req.body);
    const selectedDate = req.body.selectedDate;

    try {
        // 제목이 비어 있으면 DB저장하지 않기, 예외처리
        if(req.body.contents == ''){
            res.send('내용 입력하세요.');
        } else {
            await db.collection('post').insertOne({
                date: "2024-05-09",
                contents: req.body.content,
                check: false
            })
            res.redirect('/'); // 유저를 다른페이지로 이동 시킬 수 있음
        }
    } catch(e) {
        console.log(e)
        res.status(500).send('서버 error');
    }
});

app.get('/todowrite', (req, res) => {
    res.render('todowrite.ejs')
});

app.post('/todoadd', async(req, res) => {
    console.log(req.body);
    const selectedDate = req.body.selectedDate;

    try {
        // 제목이 비어 있으면 DB저장하지 않기, 예외처리
        if(req.body.contents == ''){
            res.send('내용 입력하세요.');
        } else {
            await db.collection('todo').insertOne({
                date: "2024-05-09",
                todo: req.body.content,
                check: false
            })
            res.redirect('/'); // 유저를 다른페이지로 이동 시킬 수 있음
        }
    } catch(e) {
        console.log(e)
        res.status(500).send('서버 error');
    }
});

// 수정페이지 만들기
app.get('/edit/:id', async (req, res) => {
    // MongoDB에서 해당 _id와 일치하는 게시물을 찾음
    let result = await db.collection('post').findOne({
        _id: new ObjectId(req.params.id)
    })
    let result2 = await db.collection('todo').findOne({
        _id: new ObjectId(req.params.id)
    })
    // console.log(result);

    if(result) {
        res.render('edit.ejs', {result:result})
    } else if(result2) {
        res.render('todoedit.ejs', {result:result2})   
    } else {
        res.status(404).send('url이 이상함')
    }
})

app.put('/edit', async(req, res) => {
    console.log("1111"+req.body);
    // MongoDB에서 해당 _id와 일치하는 게시물을 수정
    await db.collection('post').updateOne({
        _id: new ObjectId(req.body.id)
    }, {$set: {
        contents: req.body.content
    }})

    await db.collection('todo').updateOne({
        _id: new ObjectId(req.body.id)
    }, {$set: {
        todo: req.body.content
    }})

    console.log(req.body)
    res.redirect('/')
})

// 삭제페이지 만들기
app.delete('/delete', async(req, res) => {
    console.log(req.query);
    await db.collection('post').deleteOne({
        _id: new ObjectId(req.query.docid)
    })
    await db.collection('todo').deleteOne({
        _id: new ObjectId(req.query.docid)
    })
    res.send('삭제완료');
})

// check 변환
app.put('/check/:id', async(req, res) => {
    const id = req.params.id;
    // console.log("id: "+id);

    let result = await db.collection('post').findOne({
        _id: new ObjectId(id)
    })

    let todoresult = await db.collection('todo').findOne({
        _id: new ObjectId(id)
    })

    if(result) { // id가 일정관리 리스트에 있을 경우
        const newCheck = !result.check; // check 필드를 반전

        await db.collection('post').updateOne({ // post 데이터베이스에서
            _id: new ObjectId(req.params.id) // id를 찾아
        }, {$set: { 
            check: newCheck // 반전시킨 check로 업데이트
        }})
        res.send(newCheck); // 클라이언트로 응답 -> 클라이언트는 e로 받음
    } else if(todoresult) { // id가 todo 리스트에 있을 경우
        const todoNewCheck = !todoresult.check; // todo리스트의 check필드를 반전
        await db.collection('todo').updateOne({ // todo 데이터베이스에서
            _id: new ObjectId(req.params.id) // id를 찾아
        }, {$set: {
            check: todoNewCheck // 반전시킨 check로 업데이트
        }})
        res.send(todoNewCheck); // 반전시킨 check를 클라이언트로 응답
    } else {
        res.send("오류");
    }
    
})

// 회원가입
app.get('/register', (req, res) => {
    res.render('register.ejs')
})

app.post('/register', async (req, res) => {
    // db에 저장
    let hash = await bcrypt.hash(req.body.password, 10)
    console.log(hash)

    await db.collection('user').insertOne({
        username: req.body.username,
        password: hash,
        nickname: req.body.nickname,
        imgurl: "/uploads/profile.png"
    })
    res.redirect('/login');
})

// 로그인
app.get('/login', async (req, res) => {
    res.render('login.ejs')
})

app.post('/login', async(req, res) => {
    let result = await db.collection('user').findOne({
        username: req.body.username
    })

    if(!result) {
        res.send("User not found")
    }

    if(await bcrypt.compare(req.body.password, result.password)) {
        // 유저가 인증되었으면 JWT 토큰 생성
        const token = jwt.sign({
            id: result._id,
            username: result.username
        },
        secretKey, { expiresIn: '1h'}
        );

        // 쿠키에 토큰 설정 // secure: true는 HTTPS에서만 작동
        res.cookie('auth_token', token, { httpOnly: true, secure: false });

        // 리다이렉트
        res.redirect('/');
    } else {
        res.send("비번불일치")
    }
})

// 대시보드 라우트(인증 필요)
app.get('/dashboard', (req, res) => {
    const token = req.cookies.auth_token;

    if(token) {
        jwt.verify(token, secretKey, (err, decoded) => {
            if(err) {
                return res.status(401).send('인증 오류: 토큰이 유효하지 않습니다.');
            } else {
                res.send(`환영합니다, ${decoded.username}`);
            }
        });
    } else {
        res.status(401).send('인증 오류: 토큰이 없습니다.');
    }
})

// 마이페이지
app.get('/mypage', async (req, res) => {
    const token = req.cookies.auth_token;
    // let result = await db.collection('user').find().toArray();
    // console.log(token);
    
    // 토큰이 있을 경우
    if(token) {
        // jwt토큰을 해석
        jwt.verify(token, secretKey, async (err, decoded) => {
            if(err) {
                return res.status(401).send('인증 오류: 토큰이 유효하지 않습니다.');
            } else {
                // id 가져오기
                const userId = decoded.id;
                let userresult = await db.collection('user').findOne({ _id: new ObjectId(userId) });
                // console.log(userresult);
                res.render('mypage.ejs', { userresult: userresult });
            }
        })
    }

    
})

app.put('/mypage', upload.single('fileInput'), async (req, res) => {
    const reqimageurl = req.file == null ? '' : '/' + req.file?.path;
    const reqnickname = req.body.nickname;
    const reqintroduce = req.body.intro;
    const token = req.cookies.auth_token;
    console.log('/image: '+reqimageurl)
    console.log(reqintroduce);

    // jwt토큰 해석
    jwt.verify(token, secretKey, async (err, decoded) => {
        if(err) {
            return res.status(401).send('인증 오류: 토큰이 유효하지 않습니다.');
        } else {
            // id 가져오기
            const userId = decoded.id;
            // console.log("userid: "+userId);

            let result = await db.collection('user').findOne({ _id: new ObjectId(userId) });
            // 업데이트할 필드 초기화
            let updateFields = {
                introduce: ''
            }

            // reqimageurl 값이 있을 경우 updateFields에 추가
            if(reqimageurl) {
                updateFields.imgurl = reqimageurl;

                await db.collection('user').updateOne(
                    { _id : new ObjectId( userId )},
                    { $set: updateFields }
                )
            }

            if(reqnickname) {
                updateFields.nickname = reqnickname;

                await db.collection('user').updateOne(
                    { _id : new ObjectId( userId )},
                    { $set: updateFields }
                )   
            }

            if(reqintroduce) {
                updateFields.introduce = reqintroduce;

                await db.collection('user').updateOne(
                    { _id: new ObjectId( userId )},
                    { $set: updateFields }
                )
            }
        }

        res.redirect('/')
    })

})

// 검색(미완성)
app.get('/search', async (req, res) => {
    let search_condition = [{
        $search: {
            index: 'post_index',
            text: { query: req.query.val, path: 'contents' }
        }
    }]

    let result = await db.collection('post').aggregate(search_condition).toArray()
    console.log(result);
    res.render('search.ejs', { posts: result })
})