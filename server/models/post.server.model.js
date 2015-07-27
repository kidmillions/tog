(function() {
  'use strict';
  var db = require('../config/db');
  var Post = require('../config/schema').Post;

  Post.add = function(postData, callback) {
    new Post(postData)
      .save()
      .then(function(post) {
        if (!post) {
          callback("Invalid post data");
        } else {
          callback(null, post);
        }
      });
  };

  Post.remove = function(postUrl, callback) {
    /* Create a post object which we call
     .fetch() on to search the database to see
     if that post already exists */
    new Post({
        'url': postUrl
      })
      .fetch()
      /* .fetch() returns a promise so we call .then() */
      .then(function(post) {
        /* If the user doesn't exist, return error message. Otherwise return profile information */
        if (!post) {
          callback("Invalid post url.\n");
        } else {
          db.knex('posts').where('url', postUrl)
            .del()
            .then(function() {
              callback(null, post);
            });
        }
      });
  };

  Post.modify = function(postData, callback) {
    new Post({
        'url': postData.url
      })
      .fetch()
      .then(function(post) {
        /* If post doesn't exist, return error message */
        if (!post) {
          callback("Invalid post url");
        } else {
          /* If post exists, update all of its attributes with the data passed in from the POST request */
          for (var key in postData) {
            /* Check to make sure that the attribute we are trying to change already exists for the post.  If it doesn't, we know that it is an invalid column header and we don't want to add it.  */
            if (post.get(key) !== undefined) {
              post.set(key, postData[key]);
            }
          }
          post.save();
          callback(null, post);
        }
      });
  };

  Post.postInfo = function(postId, callback) {
    /* Create a post object which we call
    .fetch() on to search the database to see
    if that post already exists */
    new Post({
        'id': postId
      })
      .fetch()
      /* .fetch() returns a promise so we call .then() */
      .then(function(post) {
        /* If the post doesn't exist, return error message. Otherwise return profile information */
        if (!post) {
          callback("Invalid post id.");
        } else {
          db.knex.raw(' \
          SELECT \
            posts.id AS post_id, \
            posts.title AS post_title, \
            posts.url AS post_url, \
            posts.file AS file, \
            posts.created_at AS created_date, \
            posts.views AS post_views, \
            users.name AS author, \
            users.username AS username, \
            users.profile_photo_url AS profile_photo_url \
          FROM posts, users \
          WHERE posts.user_id = users.id \
            AND posts.published = true \
            AND posts.id = ' + postId)
            .then(function(data) {
              var postData = data[0][0];
              if (!postData) {
                callback("Invalid post id.");
              } else {
                db.knex.raw(' \
                  SELECT \
                  tags.title AS title, \
                  tags.id AS id \
                  FROM posts, tags, post_tag_join \
                  WHERE posts.id = post_tag_join.post_id \
                    AND post_tag_join.tag_id = tags.id \
                    AND posts.published = true \
                    AND posts.id = ' + postId)
                  .then(function(data) {
                    postData.tags = data[0];
                    db.knex('likes').where({
                      post_id: postId
                    }).count()
                      .then(function(countData) {
                        postData.likes = countData[0]['count(*)'];
                        callback(null, postData);
                      });
                });
              }
            });
        }
      });
  };

  Post.getPostsOnQuery = function(query, queryType, callback) {
    if (queryType === 'tag') {
      // get all posts that have a given tag
      db.knex.raw('\
        SELECT \
          posts.id AS post_id, \
          posts.title AS post_title, \
          posts.url AS post_url, \
          posts.created_at AS created_date, \
          posts.summary AS summary, \
          posts.created_at AS post_date, \
          users.name AS author, \
          posts.published AS published, \
          COUNT(likes.id) AS likes, \
          users.profile_photo_url AS profile_photo_url \
        FROM \
          users INNER JOIN posts ON users.id = posts.user_id \
          INNER JOIN post_tag_join ON posts.id = post_tag_join.post_id \
          INNER JOIN tags ON post_tag_join.tag_id = tags.id \
          LEFT JOIN likes ON posts.id = likes.post_id \
        WHERE \
          posts.published = true AND \
          tags.title = "' + query + '" \
        GROUP BY posts.id \
         ORDER BY created_date DESC, likes DESC \
        LIMIT 50')
        .then(function(data) {
          callback(null, data[0]);
        });
    } else {
      db.knex.select('posts.id AS post_id', 'posts.title AS post_title', 'posts.summary AS summary', 'posts.created_at AS created_date', 'posts.published AS published',
          'posts.url AS post_url', 'users.name AS author', 'users.profile_photo_url AS profile_photo_url')
        .from('posts').where(queryType, 'like', '%' + query + '%').leftOuterJoin('users', 'posts.user_id', 'users.id')
        .then(function(data) {
          callback(null, data);
        });
    }

  };

  Post.getAllPosts = function(callback, options) {
    db.knex.raw(' \
      SELECT \
        posts.id AS post_id, \
        posts.title AS post_title, \
        posts.url AS post_url, \
        posts.created_at AS created_date, \
        posts.summary AS summary, \
        users.name AS author, \
        users.username AS username, \
        users.profile_photo_url AS profile_photo_url \
      FROM posts, users \
      WHERE posts.user_id = users.id \
      AND posts.published = true')
      .then(function(data) {
        callback(null, data[0]);
      });
  };




  //takes a post and returns 20 posts that were created earlier than it
  Post.getMorePosts = function(lastPost) {
    console.log("last post: " + JSON.stringify(lastPost));
    var last_id = JSON.parse(lastPost).post_id;
    // var rawDate = JSON.parse(lastPost).created_date;
    // var lastDate = rawDate.replace(/T/, ' ').replace('.000', '').replace(/Z/, '');
    console.log("retrieving all posts with id < ", last_id);
    return db.knex.raw(' \
      SELECT \
        posts.id AS post_id, \
        posts.title AS post_title, \
        posts.url AS post_url, \
        posts.created_at AS created_date, \
        posts.summary AS summary, \
        users.name AS author, \
        users.profile_photo_url AS profile_photo_url \
      FROM posts, users \
      WHERE posts.user_id = users.id \
        AND posts.published = true \
        AND posts.id < "'+last_id+'" \
      ORDER BY posts.id DESC \
      LIMIT 5');
  };

  // BROKEN, DO NOT USE -->
  /*
  get posts with options obj: {
    select: "id, title",
    from: "posts",
    where: function() {
      this.where('id', 1)
        .orWhere('id', '>', 10)
        .orWhere({
          title: 'the worst blog ever'
        })
    },
    groupBy: "id",
    orderBy: "'id', 'desc'",
    limit: 1,
    offset: 10,
    //feel free to add more, just remember to add them below as well
  }
  */

  // Post.getPosts = function(options) {
  //   return db.knex
  //     .distinct()
  //     .select(options.select || null)
  //     .from(options.from || null)
  //     .where(options.where || null)
  //     .groupBy(options.groupBy || null)
  //     .orderBy(options.orderBy || null)
  //     .limit(options.limit || null)
  //     .offset(options.offset || null)
  // }

  Post.getAllTitles = function() {
    return db.knex
      .distinct()
      .select('title', 'id').from('posts').distinct('id');
  };

  Post.getAllAuthors = function() {
    return db.knex
      .distinct()
      .select('name', 'username').from('users').distinct('name');
  };

  Post.addView = function(postId) {
    new Post({
        id: postId
      })
      .fetch()
      .then(function(post) {
        post.set('views', post.get('views') + 1);
        post.save();
      });
  };

  /* For profile page */
  Post.recentUserPosts = function(username) {
    return db.knex.raw('\
      SELECT \
        posts.id AS post_id, \
        posts.title AS post_title, \
        posts.url AS post_url, \
        posts.created_at AS created_date, \
        posts.summary AS summary, \
        posts.views AS views, \
        posts.published AS published, \
        COUNT(likes.id) AS likes, \
        users.name AS author, \
        users.username AS username, \
        users.profile_photo_url AS profile_photo_url \
      FROM \
      users INNER JOIN posts ON users.id = posts.user_id \
      LEFT JOIN likes ON posts.id = likes.post_id \
      WHERE \
        users.username = "' + username + '" \
      GROUP BY posts.id \
      ORDER BY created_date DESC \
      LIMIT 20');
  };

  /* For profile page */
  Post.topUserPosts = function(username) {
    return db.knex.raw('\
      SELECT \
        posts.id AS post_id, \
        posts.title AS post_title, \
        posts.url AS post_url, \
        posts.created_at AS created_date, \
        posts.summary AS summary, \
        posts.views AS views, \
        posts.published AS published, \
        COUNT(likes.id) AS likes, \
        users.name AS author, \
        users.username AS username, \
        users.profile_photo_url AS profile_photo_url \
      FROM \
      users INNER JOIN posts ON users.id = posts.user_id \
      LEFT JOIN likes ON posts.id = likes.post_id \
      WHERE \
        users.username = "' + username + '" \
      GROUP BY posts.id \
      ORDER BY likes DESC \
      LIMIT 20');
  };

  /* For home page */
  Post.getRecentPosts = function() {
    return db.knex.raw(' \
      SELECT \
        posts.id AS post_id, \
        posts.title AS post_title, \
        posts.url AS post_url, \
        posts.created_at AS created_date, \
        posts.summary AS summary, \
        posts.views AS views, \
        posts.published AS published, \
        COUNT(likes.id) AS likes, \
        users.name AS author, \
        users.username AS username, \
        users.profile_photo_url AS profile_photo_url \
      FROM \
      users INNER JOIN posts ON users.id = posts.user_id \
      LEFT JOIN likes ON posts.id = likes.post_id \
      WHERE posts.published = true \
      GROUP BY posts.id \
      ORDER BY created_date DESC, likes DESC \
      LIMIT 10')
  };


  /* For home page */
  Post.getTopPosts = function() {
    return db.knex.raw('\
      SELECT \
        posts.id AS post_id, \
        posts.title AS post_title, \
        posts.url AS post_url, \
        posts.created_at AS created_date, \
        posts.summary AS summary, \
        posts.views AS views, \
        posts.published AS published, \
        COUNT(likes.id) AS likes, \
        users.name AS author, \
        users.username AS username, \
        users.profile_photo_url AS profile_photo_url \
      FROM \
      users INNER JOIN posts ON users.id = posts.user_id \
      LEFT JOIN likes ON posts.id = likes.post_id \
       WHERE posts.published = true \
      GROUP BY posts.id \
      ORDER BY likes DESC, views DESC\
      LIMIT 20')
  };

  module.exports = Post;
})();
