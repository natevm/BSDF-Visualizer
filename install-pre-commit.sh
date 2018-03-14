#!/bin/sh
# This gist contains pre-commit hooks to prevent you from commiting bad code or to the wrong branch.
# There are four variants that I have built:
# - pre-commit: stops commits to "master" and "develop" branches.
# - pre-commit-2: also includes a core.whitespace check.
# - pre-commit-3: the core.whitespace check and an EOF-newline-check.
# - pre-commit-4: only the core.whitespace check.
# Set desired version like this before installing:
# FILE=pre-commit

# Global installation instructions: (requires git 2.9 or later)
# NOTE: if you configure core.hooksPath, then git only runs the hooks from that directory (and ignores repo-specific hooks in .git/hooks/), but these pre-commit hooks contain a block at the end which executes a repo-specific pre-commit hook if it's present. It's a small hax that I think is pretty nice.
# mkdir $HOME/.githooks
# git config --global core.hooksPath $HOME/.githooks
# curl -fL -o $HOME/.githooks/pre-commit https://gist.githubusercontent.com/stefansundin/9059706/raw/${FILE:-pre-commit}
# chmod +x $HOME/.githooks/pre-commit
# Uninstall:
# rm $HOME/.githooks/pre-commit

# Install in current Git repo only:
# curl -fL https://gist.githubusercontent.com/stefansundin/9059706/raw/install-pre-commit.sh | sh -s ${FILE:-pre-commit}
# Uninstall:
# rm .git/hooks/pre-commit

GIT_DIR=`git rev-parse --git-common-dir 2> /dev/null`

echo
echo

if [ "$GIT_DIR" == "" ]; then
  echo "This does not appear to be a git repo."
  exit 1
fi

if [ -f "$GIT_DIR/hooks/pre-commit" ]; then
  echo "There is already a pre-commit hook installed. Delete it first."
  echo
  echo "    rm '$GIT_DIR/hooks/pre-commit'"
  echo
  exit 2
fi

FILE=${1:-pre-commit-4}

echo "Downloading $FILE hook from https://gist.github.com/stefansundin/9059706"
echo

curl -fL -o "$GIT_DIR/hooks/pre-commit" "https://gist.githubusercontent.com/stefansundin/9059706/raw/$FILE"
if [ ! -f "$GIT_DIR/hooks/pre-commit" ]; then
  echo "Error downloading pre-commit script!"
  exit 3
fi

chmod +x "$GIT_DIR/hooks/pre-commit"

echo "You're all set! Happy hacking!"
echo "P.S. There is now a way to install this globally, see the instructions on the gist page."

exit 0