(function() {
  'use strict';
  angular.module('profileController', ['userFactory', 'tagFactory', 'postFactory'])
  .controller('profileController', function ($scope, $rootScope, userFactory, tagFactory, postFactory, $stateParams) {
    $scope.username = $stateParams.username;
    $scope.posts = userFactory.getPostResult();

    /* Listens for events triggered in profileSubNavDirective to update the list of posts shown */
    $rootScope.$on('changeProfilePostList', function(event, list) {
      if (list === 'recent') {
        userFactory.getRecentUserPosts($stateParams.username)
          .then(function(posts) {
            $scope.posts = posts;
          });
      } else if (list === 'top') {
        userFactory.getTopUserPosts($stateParams.username)
          .then(function(posts) {
            $scope.posts = posts;
          });
      }
    });


    /* Retrieves user information and tag information by passing in username.  username must be unique because it is tied to Github */
    userFactory.getUserByUsername($scope.username)
      .then(function(user) {
        /* Assigns profile user to scope */
        $scope.user = user;

        /* Checks if current user is owner of profile page */
        if (!$rootScope.loggedIn) {
          $scope.isOwner = false;
        } else {
          userFactory.ownsProfile(window.localStorage.jwtToken, user.username)
          .then(function(data) {
            $scope.isOwner = data.owner;
            $scope.newUser = data.newUser;
          });
        }

        /* Set url to fetch raw bio content and edit bio */
        var bioUrl = "https://raw.githubusercontent.com/" + $scope.user.username + "/codesnap.io/master/bio.md";
        $scope.editBioUrl = "https://github.com/" + $scope.user.username + "/codesnap.io/edit/master/bio.md";
        $scope.githubUrl = "https://github.com/" + $scope.user.username;

        userFactory.getBio(bioUrl, $rootScope.loggedIn, $scope.user, $rootScope.user)
          .then(function (bio, err) {
            if (err) {
              /* If there is no bio file, set $scope.bio to false so that the bio and edit bio elements don't show */
              $scope.bio = false;
            } else {
              /* Set scope post equal to the markdown content retrieved from Github */
              $scope.bio = bio;

            }
          });
      });

    /* Get user's tags */
    tagFactory.getUserTags($scope.username)
      .then(function(tags) {
        $scope.tags = tags;
      });


    if ($rootScope.newUser === true) {
      $rootScope.newUser = false;
    }


  });
})();
