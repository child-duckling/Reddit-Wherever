import { SubredditType, DataType } from './types';

export {
  getVote,
  getDir,
  setIcon,
  handleClickOnly,
  toggleYoutube,
  detectTheme,
  getQueries,
  getPostArr,
  getSubreddits,
  getCommentArr,
  fixHref,
  decodeHtml,
  formatNumber,
  convertDate,
};

const getVote = (likes: boolean) => {
  if (likes === true) return 1;
  if (likes === false) return -1;
  return 0;
};

// Get vote direction
const getDir = (voteDir: number, vote: number) => {
  let dir: number = voteDir;
  if ((dir === 1 && vote === 1) || (dir === -1 && vote === -1)) {
    dir = 0;
  }
  return dir;
};

// Changes icon color
const setIcon = (postArr: DataType[]) => {
  const icon = postArr.length
    ? '../images/reddit_16.png'
    : '../images/grey_16.png';
  chrome.browserAction.setIcon({
    path: {
      16: icon,
    },
  });
};

// Only check for posts when icon is clicked
const handleClickOnly = () => {
  chrome.storage.sync.get('clickOnly', ({ clickOnly }) => {
    const value = !clickOnly;
    chrome.storage.sync.set({ clickOnly: value });
    if (value === true) {
      chrome.browserAction.setIcon({
        path: {
          16: '../images/reddit_16.png',
        },
      });
    }
  });
};

// Switch to youtube comments
const toggleYoutube = () => {
  document.getElementById('redComments')!.style.display = 'none';
  document.getElementById('comments')!.style.display = 'block';
  document.getElementById('redditImgWrap')!.style.display = 'flex';
  window.scrollBy(0, 1); // youtube comments won't load unless movement is detected
};

// Detects system/ setting theme
const detectTheme = () => {
  if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
    // OS theme setting detected as dark
    document.documentElement.setAttribute('data-theme', 'dark');
  }
  chrome.storage.sync.get('theme', ({ theme }) => {
    // local storage is used to override OS theme settings
    if (theme === 'dark' || theme === 'light') {
      document.documentElement.setAttribute('data-theme', theme);
    }
  });
};

// Gets reddit search query URLs
const getQueries = (url: string): string[] => {
  const queries = [`https://api.reddit.com/submit?url=${url}`];

  if (url.startsWith('https')) {
    queries.push(
      `https://api.reddit.com/submit?url=${url.replace('https', 'http')}`
    );
  } else {
    queries.push(
      `https://api.reddit.com/submit?url=${url.replace('http', 'https')}`
    );
  }

  for (let i = 0; i < 2; i++) {
    if (url.endsWith('/')) {
      queries.push(queries[i].slice(0, -1));
    } else {
      queries.push(`${queries[i]}/`);
    }
  }

  for (let i = 0; i < 4; i++) {
    queries.push(
      queries[i].replace(
        'api.reddit.com/submit?url=',
        'www.reddit.com/api/info.json?url='
      )
    );
  }

  if (url.indexOf('www.youtube.com/watch?v=') !== -1) {
    for (let i = 0; i < 8; i++) {
      queries.push(queries[i].replace('www.youtube.com/watch?v=', 'youtu.be/'));
    }
  }
  return queries;
};

// Gets list of matching reddit posts
const getPostArr = async (queries: string[]): Promise<DataType[]> => {
  const promisesFetch: Promise<Response>[] = [];
  const promisesJson: Promise<Response>[] = [];
  let postArr: DataType[] = [];

  for (let i = 0; i < queries.length; i++) {
    promisesFetch.push(fetch(queries[i]));
  }

  await Promise.all(promisesFetch).then(async (resFetch: Response[]) => {
    for (let i = 0; i < resFetch.length; i++) {
      promisesJson.push(resFetch[i].json());
    }
    await Promise.all(promisesJson).then((resJson: Response[]) => {
      for (let i = 0; i < resJson.length; i++) {
        if (
          (<any>resJson[i]).kind === 'Listing' &&
          (<any>resJson[i]).data.children.length > 0
        ) {
          postArr = postArr.concat((<any>resJson[i]).data.children);
        }
      }
      postArr = [
        ...new Map(
          postArr.map((item: DataType) => [item.data.id, item])
        ).values(),
      ];
      postArr = postArr.sort(compare);
    });
  });
  return postArr;
};

const compare = (a: DataType, b: DataType): number =>
  b.data.num_comments - a.data.num_comments;

// Gets and prints list of subreddits
const getSubreddits = (data: DataType[]): SubredditType[] => {
  const subreddits: SubredditType[] = [];
  for (let i = 0; i < data.length; i++) {
    subreddits.push({
      id: i,
      name: data[i].data.subreddit,
      commentNum: `(${data[i].data.num_comments})`,
    });
  }
  return subreddits;
};

// Gets list of comments from post
const getCommentArr = async (permalink: string): Promise<DataType[]> => {
  let commentArr: DataType[] = [];
  await fetch(`https://api.reddit.com${permalink}`)
    .then((response) => response.json())
    .then((json) => {
      if (
        json &&
        json[1] &&
        json[1].kind === 'Listing' &&
        json[1].data &&
        json[1].data.children.length
      ) {
        commentArr = json[1].data.children;
      }
    });
  return commentArr;
};

const fixHref = (html: string): string => {
  let fixed = decodeHtml(html).replace('<a href=', '<a target="_blank" href=');
  fixed = fixed.replace(
    '<a target="_blank" href="/',
    '<a target="_blank" href="https://reddit.com/'
  );
  return fixed;
};

const decodeHtml = (html: string): string => {
  const txt: HTMLTextAreaElement = document.createElement('textarea');
  txt.innerHTML = html;
  return txt.value;
};

const formatNumber = (num: number) =>
  Math.abs(num) > 9999
    ? `${(Math.sign(num) * (Math.abs(num) / 1000)).toFixed(0)}k`
    : `${Math.sign(num) * Math.abs(num)}`;

const convertDate = (timestamp: number) => {
  let diff: number = Date.now() - timestamp * 1000;

  if (diff < 1000) {
    return 'just now';
  }

  diff /= 1000;
  if (diff < 60) {
    return `${Math.trunc(diff)} second${diff === 1 ? '' : 's'} ago`;
  }

  diff /= 60;
  if (diff < 60) {
    return `${Math.trunc(diff)} minute${diff === 1 ? '' : 's'} ago`;
  }

  diff /= 60;
  if (diff < 24) {
    return `${Math.trunc(diff)} hour${diff === 1 ? '' : 's'} ago`;
  }

  diff /= 24;
  if (diff < 7) {
    return `${Math.trunc(diff)} day${diff === 1 ? '' : 's'} ago`;
  }

  diff /= 7;
  if (diff < 4) {
    return `${Math.trunc(diff)} week${diff === 1 ? '' : 's'} ago`;
  }

  diff /= 4;
  if (diff < 13) {
    return `${Math.trunc(diff)} month${diff === 1 ? '' : 's'} ago`;
  }

  diff /= 12;
  return `${Math.trunc(diff)} year${diff === 1 ? '' : 's'} ago`;
};
