#!/usr/bin/env node

const NodeMediaServer = require('..');
const AWS = require('aws-sdk');
const s3 = new AWS.S3();
const path = require('path');
const fs = require('fs');
const ffmpeg = require('fluent-ffmpeg');
let argv = require('minimist')(process.argv.slice(2),
  {
    string:['rtmp_port','http_port','https_port'],
    alias: {
      'rtmp_port': 'r',
      'http_port': 'h',
      'https_port': 's',
    },
    default:{
      'rtmp_port': 1935,
      'http_port': 8000,
      'https_port': 8443,
    }
  });

if (argv.help) {
  console.log('Usage:');
  console.log('  node-media-server --help // print help information');
  console.log('  node-media-server --rtmp_port 1935 or -r 1935');
  console.log('  node-media-server --http_port 8000 or -h 8000');
  console.log('  node-media-server --https_port 8443 or -s 8443');
  process.exit(0);
}

let  uploaded_mp4_flag= false;
let  uploaded_mp3_flag= false;
let mp4_bucket   = process.env.MP4_BUCKET;
let mp3_bucket   = process.env.MP3_BUCKET;

const config = {
  rtmp: {
    port: 1935,
    chunk_size: 60000,
    gop_cache: true,
    ping: 30,
    ping_timeout: 60
  },
  http: {
    port: argv.http_port,
    mediaroot: __dirname+'/media',
    webroot: __dirname+'/www',
    allow_origin: '*',
    api: true
  },
  // https: {
  //   port: argv.https_port,
  //   key: __dirname+'/privatekey.pem',
  //   cert: __dirname+'/certificate.pem',
  // },
  auth: {
    api: true,
    api_user: 'admin',
    api_pass: 'admin',
    play: false,
    publish: false,
    secret: 'nodemedia2017privatekey'
  },
  trans: {
    ffmpeg: '/usr/bin/ffmpeg',
    tasks: [
      {
        app: 'live',
        mp4: true,
        mp4Flags: '[movflags=frag_keyframe+empty_moov]',
      }
    ]
  }
};


function getFilesInFolder(folderPath) {
  try {
    // Read the contents of the folder synchronously
    const files = fs.readdirSync(folderPath);
    return files;
  } catch (error) {
    console.error('Error reading folder:', error);
    return [];
  }
}

function uploadFileToS3(bucketName, fileKey, filePath) {
  const fileStream = fs.createReadStream(filePath);

  const params = {
    Bucket: bucketName,
    Key: fileKey,
    Body: fileStream
  };

  return new Promise((resolve, reject) => {
    s3.upload(params, (err, data) => {
      if (err) {
        reject(err);
      } else {
        resolve(data);
      }
    });
  });
}

let nms = new NodeMediaServer(config);
nms.run();

nms.on('preConnect', (id, args) => {
  console.log('[NodeEvent on preConnect]', `id=${id} args=${JSON.stringify(args)}`);
  // let session = nms.getSession(id);
  // session.reject();
});

nms.on('postConnect', (id, args) => {
  console.log('[NodeEvent on postConnect]', `id=${id} args=${JSON.stringify(args)}`);
});

nms.on('doneConnect', (id, args) => {
  console.log('[NodeEvent on doneConnect]', `id=${id}  args=${JSON.stringify(args)}`);

  //stream_path = args["streamPath"];
  files_path = "/home/ubuntu/Node-Media-Server/bin/media/live/zoom";
  //file_name =  files[0];
  //files_path = parent_path + stream_path;
  console.log(files_path)

  const mp4_file = getFilesInFolder(files_path)[0];

  if (!uploaded_mp4_flag){
    uploadFileToS3(mp4_bucket, mp4_file, path.join(files_path,mp4_file))
    .then(data => {
      console.log('File uploaded successfully:', data);
      uploaded_mp4_flag=true;
    })
    .catch(err => {
      console.error('Error uploading file:', err);
    });
  }

  const input_file = path.join(files_path,mp4_file);
  const output_file = path.join(files_path,`${path.parse(mp4_file).name}.mp3`);
  ffmpeg(input_file)
  .toFormat('mp3')
  .outputOptions('-q:a 0') // Set audio quality (0 is the highest quality)
  .on('end', () => {
    console.log('Conversion finished');
  })
  .on('error', (err) => {
    console.error('Error during conversion:', err);
  })
  .save(output_file);

  if (!uploaded_mp3_flag){
  uploadFileToS3(mp3_bucket, `${path.parse(mp4_file).name}.mp3`, output_file)
    .then(data => {
      console.log('File uploaded successfully:', data);
      uploaded_mp3_flag=true;
    })
    .catch(err => {
      console.error('Error uploading file:', err);
    });
  }
    
});

nms.on('prePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  // let session = nms.getSession(id);
  // session.reject();
});

nms.on('postPublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePublish', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePublish]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('prePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on prePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
  // let session = nms.getSession(id);
  // session.reject();
});

nms.on('postPlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on postPlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});

nms.on('donePlay', (id, StreamPath, args) => {
  console.log('[NodeEvent on donePlay]', `id=${id} StreamPath=${StreamPath} args=${JSON.stringify(args)}`);
});