case $MATRIXENV in
postgres)
  echo "Using PostgreSQL..."
  docker run -d -p 5432:5432 --name db --network="host" -e "POSTGRES_PASSWORD=Password123!" -e "POSTGRES_USER=wiki" -e "POSTGRES_DB=wiki" postgres:11
  while ! docker exec db psql -U wiki -d wiki -c "SELECT 1" &> /dev/null ; do
    echo "Waiting for database connection..."
    sleep 2
  done
  docker run -d -p 3000:3000 --name wiki --network="host" -e "DB_TYPE=postgres" -e "DB_HOST=localhost" -e "DB_PORT=5432" -e "DB_NAME=wiki" -e "DB_USER=wiki" -e "DB_PASS=Password123!" requarks/wiki:canary-$REL_VERSION_STRICT
  ;;
mysql)
  echo "Using MySQL..."
  docker run -d -p 3306:3306 --name db --network="host" -e "MYSQL_ROOT_PASSWORD=Password123!" -e "MYSQL_USER=wiki" -e "MYSQL_PASSWORD=Password123!" -e "MYSQL_DATABASE=wiki" mysql:8
  while ! docker exec db mysql --user=root --password=Password123! -e "SELECT 1" &> /dev/null ; do
    echo "Waiting for database connection..."
    sleep 2
  done
  docker run -d -p 3000:3000 --name wiki --network="host" -e "DB_TYPE=mysql" -e "DB_HOST=localhost" -e "DB_PORT=3306" -e "DB_NAME=wiki" -e "DB_USER=wiki" -e "DB_PASS=Password123!" requarks/wiki:canary-$REL_VERSION_STRICT
  ;;
mariadb)
  echo "Using MariaDB..."
  docker run -d -p 3306:3306 --name db --network="host" -e "MYSQL_ROOT_PASSWORD=Password123!" -e "MYSQL_USER=wiki" -e "MYSQL_PASSWORD=Password123!" -e "MYSQL_DATABASE=wiki" mariadb:10
  while ! docker exec db mysql --user=root --password=Password123! -e "SELECT 1" &> /dev/null ; do
    echo "Waiting for database connection..."
    sleep 2
  done
  docker run -d -p 3000:3000 --name wiki --network="host" -e "DB_TYPE=mariadb" -e "DB_HOST=localhost" -e "DB_PORT=3306" -e "DB_NAME=wiki" -e "DB_USER=wiki" -e "DB_PASS=Password123!" requarks/wiki:canary-$REL_VERSION_STRICT
  ;;
mssql)
  echo "Using MS SQL Server..."
  docker run -d -p 1433:1433 --name db --network="host" -e "SA_PASSWORD=Password123!" -e "ACCEPT_EULA=Y" mcr.microsoft.com/mssql/server:2019-latest
  while ! docker exec db /opt/mssql-tools/bin/sqlcmd -S localhost -U SA -P "Password123!" -Q 'CREATE DATABASE wiki' &> /dev/null ; do
    echo "Waiting for database connection..."
    sleep 2
  done
  docker run -d -p 3000:3000 --name wiki --network="host" -e "DB_TYPE=mssql" -e "DB_HOST=localhost" -e "DB_PORT=1433" -e "DB_NAME=wiki" -e "DB_USER=SA" -e "DB_PASS=Password123!" requarks/wiki:canary-$REL_VERSION_STRICT
  ;;
sqlite)
  echo "Using SQLite..."
  docker run -d -p 3000:3000 --name wiki --network="host" -e "DB_TYPE=sqlite" -e "DB_FILEPATH=db.sqlite" requarks/wiki:canary-$REL_VERSION_STRICT
  ;;
*)
  echo "Invalid DB Type!"
  ;;
esac
