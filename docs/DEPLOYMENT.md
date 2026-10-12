# Деплой MiT-viis-2026 на свой VPS через GitHub Actions

Результат: после `git push` в `main` GitHub проверяет код, собирает приложение и публикует новую версию на VPS. Посетители открывают обычный HTTPS-сайт.

```text
ваш компьютер → git push → GitHub Actions
                           npm ci → lint → tests → build (включая TypeScript)
                                                   ↓ SSH + rsync
                           VPS: Nginx → готовый dist/ → браузер
```

Сборка выполняется на GitHub. На VPS нужны Nginx, SSH и rsync; Node.js, Docker, PM2 и `vite preview` для обслуживания сайта не нужны. Vite прямо указывает, что preview предназначен для локальной проверки сборки, а production-артефакт находится в `dist/`: [документация Vite](https://vite.dev/guide/static-deploy.html).

## 1. Что подготовить

Инструкция рассчитана на **Ubuntu Server 24.04 LTS**, пользователя администратора с `sudo`, публичный IPv4 VPS, домен или поддомен и ветку `main`. Сайт размещается в корне отдельного домена, например `https://mentor.example.com/`. Все `example.com`, `VPS_IP` и `YOUR_GITHUB_LOGIN` ниже — заменяемые примеры.

Нужны:

- Доступ администратора к VPS по SSH.
- Возможность менять DNS домена.
- GitHub-репозиторий с разрешёнными Actions.
- Открытые TCP 80/443 для сайта и действующий SSH-порт для GitHub-hosted runner.

GitHub Actions подключается к VPS извне. Если SSH доступен только через VPN или список IP вашего ноутбука, этот workflow не подключится: нужно отдельно настроить доступ runner к сети сервера. Не отключайте действующие ограничения вслепую.

Дальше каждый блок отмечен местом выполнения: **локально**, **на VPS** или **в GitHub**. Команды установки предназначены для обычного Ubuntu VPS; на сервере с существующим Nginx добавляйте отдельный virtual host, сохраняя конфигурацию других сайтов.

## 2. Отправить проект в GitHub

**В GitHub:** создайте пустой репозиторий `MiT-viis-2026`, без добавления README, лицензии и `.gitignore`: они уже есть локально. Можно выбрать private. Создание и публикация репозитория выполняются вами; инструкция их автоматически не запускает.

**Локально:** сначала посмотрите текущие remotes и ветку:

```sh
cd /home/viis/projects/MiT-viis-2026
git status
git branch --show-current
git remote -v
```

Если `origin` ещё отсутствует, добавьте его и отправьте `main`:

```sh
git remote add origin git@github.com:YOUR_GITHUB_LOGIN/MiT-viis-2026.git
git push -u origin main
```

SSH-доступ вашего компьютера к GitHub должен быть настроен заранее. Можно использовать HTTPS remote и обычную GitHub-аутентификацию. Если `origin` уже существует, проверьте его адрес вместо повторного `remote add`. Не используйте force-push.

Ключ **GitHub Actions → VPS**, создаваемый ниже, отличается от ключа **ваш компьютер → GitHub**. Репозиторий на VPS клонировать не нужно: runner отправляет только сборку. GitHub Deploy Key для чтения репозитория сервером здесь не требуется.

## 3. DNS и базовая подготовка VPS

**У DNS-провайдера:** добавьте A-запись `mentor.example.com → VPS_IP`. AAAA добавляйте только при настроенном IPv6 на этом же сервере. Пока настраиваете сертификат, используйте прямое DNS-разрешение без CDN-прокси.

**На VPS, от администратора:**

```sh
sudo apt update
sudo apt install -y nginx rsync curl
sudo systemctl enable --now nginx
sudo adduser --disabled-password --gecos '' mit-deploy
sudo install -d -o mit-deploy -g mit-deploy -m 755 /var/www/mit-viis-2026
sudo install -d -o mit-deploy -g mit-deploy -m 755 /var/www/mit-viis-2026/releases
sudo install -d -o mit-deploy -g mit-deploy -m 755 /var/www/mit-viis-2026/shared/assets
sudo install -d -o mit-deploy -g mit-deploy -m 700 /home/mit-deploy/.ssh
```

Если `mit-deploy` уже существует, пропустите `adduser` и проверьте его назначение. **Не добавляйте пользователя деплоя в sudoers.** Он меняет файлы сайта; установку пакетов, Nginx и сертификаты настраивает администратор.

Если используете UFW, сначала разрешите **ваш действующий SSH-порт**, затем HTTP/HTTPS. Ниже пример только для SSH на 22:

```sh
sudo ufw allow 22/tcp
sudo ufw allow 'Nginx Full'
sudo ufw status verbose
```

Если UFW был выключен и вы хотите включить его: сохраните текущую SSH-сессию, проверьте правила для SSH и других нужных сервисов, затем выполните `sudo ufw enable` и проверьте вход во второй сессии. Отдельно настройте firewall/security group у VPS-провайдера. [Правила UFW в документации Ubuntu](https://ubuntu.com/server/docs/how-to/security/firewalls/).

## 4. Отдельный ключ для Actions

**Локально**, за пределами репозитория:

```sh
ssh-keygen -t ed25519 -C 'mit-github-actions' -f ~/.ssh/mit_viis_actions -N ''
```

При вопросе о перезаписи существующего ключа остановитесь и выберите новое имя. Для этого unattended workflow используется отдельный ключ без passphrase; личный SSH-ключ для него не копируйте.

- `~/.ssh/mit_viis_actions.pub` — публичная часть, устанавливается на VPS.
- `~/.ssh/mit_viis_actions` — приватная часть, сохраняется в GitHub Actions Secret.

Посмотреть публичную часть можно командой:

```sh
cat ~/.ssh/mit_viis_actions.pub
```

**На VPS:**

```sh
sudo -u mit-deploy touch /home/mit-deploy/.ssh/authorized_keys
sudo chmod 600 /home/mit-deploy/.ssh/authorized_keys
sudo -u mit-deploy nano /home/mit-deploy/.ssh/authorized_keys
```

Добавьте одну строку, вставив полную публичную часть после `restrict `:

```text
restrict ssh-ed25519 REPLACE_WITH_PUBLIC_KEY mit-github-actions
```

`restrict` отключает forwarding и PTY; обычные команды SSH и rsync продолжают работать. Этот ключ всё равно даёт возможность выполнять команды от имени `mit-deploy`, поэтому он предназначен только для доверенного deployment workflow.

**Локально:** проверьте вход (для нестандартного порта замените 22):

```sh
ssh -i ~/.ssh/mit_viis_actions -p 22 mit-deploy@VPS_IP 'whoami'
```

Ожидаемый ответ — `mit-deploy`.

### Проверить ключ самого сервера

Ключ сервера подтверждает, что runner подключается к вашему VPS. Получите fingerprint через доверенную консоль VPS-провайдера:

```sh
sudo ssh-keygen -lf /etc/ssh/ssh_host_ed25519_key.pub
```

**Локально:** скачайте публичный host key и сравните fingerprint с консолью:

```sh
ssh-keyscan -p 22 -t ed25519 VPS_IP > /tmp/mit-vps-known-hosts
ssh-keygen -lf /tmp/mit-vps-known-hosts
```

Только после совпадения используйте содержимое `/tmp/mit-vps-known-hosts` как `VPS_KNOWN_HOSTS`. В `ssh-keyscan` укажите ровно тот IP/hostname и порт, которые потом будут в Secrets. Для нестандартного порта строка содержит `[host]:port`. Не заменяйте проверку на `StrictHostKeyChecking=no` и не доверяйте одному лишь выводу `ssh-keyscan` без сравнения.

## 5. Nginx и временная стартовая страница

**На VPS:** создайте стартовый релиз. Выполняется один раз до первого деплоя; если `current` уже существует, сначала разберитесь с действующим сайтом.

```sh
sudo -u mit-deploy mkdir -p /var/www/mit-viis-2026/releases/bootstrap
printf '%s\n' '<!doctype html><html lang="ru"><meta charset="utf-8"><title>MiT</title><p>MiT: сервер готов к первому деплою.</p></html>' | sudo -u mit-deploy tee /var/www/mit-viis-2026/releases/bootstrap/index.html >/dev/null
sudo -u mit-deploy ln -s /var/www/mit-viis-2026/releases/bootstrap /var/www/mit-viis-2026/current
```

Откройте конфигурацию:

```sh
sudo nano /etc/nginx/sites-available/mit-viis-2026
```

Вставьте содержимое **[готового nginx.conf](deployment/nginx.conf)** и замените `mentor.example.com` своим доменом. Затем:

```sh
sudo ln -s /etc/nginx/sites-available/mit-viis-2026 /etc/nginx/sites-enabled/mit-viis-2026
sudo nginx -t
```

Только если `nginx -t` успешен:

```sh
sudo systemctl reload nginx
curl -I http://mentor.example.com
```

В браузере должна открыться временная страница. Не удаляйте другие сайты из `sites-enabled`. Если нужная ссылка уже создана, повторно `ln -s` не нужен.

Nginx читает `/var/www/mit-viis-2026/current`, а `/assets/` — общий каталог файлов Vite с хешами. Смена `current` публикует целую сборку; старые assets остаются доступны открытым вкладкам. Для HTML задаётся перепроверка кэша, для хешированных assets — длительное кэширование. `#/roadmap` обрабатывается браузером: серверу не нужен SPA fallback на каждый несуществующий файл. Механизм `root`/`alias` и `try_files` описан в [документации Nginx](https://docs.nginx.com/nginx/admin-guide/web-server/serving-static-content/).

## 6. HTTPS

**На VPS:** после работающего HTTP и DNS установите Certbot. Ниже вариант snap для Ubuntu; если Certbot уже установлен другим способом, используйте существующую установку, не смешивая её со snap.

```sh
sudo apt install -y snapd
sudo snap install --classic certbot
sudo /snap/bin/certbot --nginx -d mentor.example.com --redirect
sudo /snap/bin/certbot renew --dry-run
```

Укажите свой домен, рабочий email и ответьте на вопросы Certbot. Откройте `https://mentor.example.com`: временная страница должна работать через HTTPS. Certbot сам дополнит Nginx-конфигурацию; после этого не заменяйте её начальным HTTP-шаблоном при каждом деплое. Snap устанавливает автоматическое продление; `renew --dry-run` проверяет его работоспособность. [Официальная инструкция Certbot для Nginx](https://certbot.eff.org/instructions?ws=nginx&os=snap).

Сборки через Actions не меняют Nginx-конфигурацию и не перезапускают сервис.

## 7. GitHub Secrets и Variables

**В GitHub → ваш репозиторий → Settings → Secrets and variables → Actions.** Используем **Repository secrets**, поэтому Environment `production` создавать не требуется.

Вкладка **Secrets → New repository secret**:

| Имя               | Значение                                                                                                 |
| ----------------- | -------------------------------------------------------------------------------------------------------- |
| `VPS_HOST`        | Публичный IPv4 или DNS-имя VPS, без `https://`, пользователя и порта. Шаблон не принимает IPv6-литералы. |
| `VPS_PORT`        | SSH-порт, например `22`. Если не задан, workflow использует `22`.                                        |
| `VPS_SSH_KEY`     | Полный текст приватного `~/.ssh/mit_viis_actions`, включая строки BEGIN/END и переводы строк. Не `.pub`. |
| `VPS_KNOWN_HOSTS` | Полная проверенная строка из `/tmp/mit-vps-known-hosts`, а не только `SHA256:...`.                       |

Вкладка **Variables → New repository variable**:

| Имя        | Значение                                                                           |
| ---------- | ---------------------------------------------------------------------------------- |
| `SITE_URL` | Полный HTTPS-адрес, например `https://mentor.example.com`, без hash/пути страницы. |

Пользователь `mit-deploy` и каталог `/var/www/mit-viis-2026` заданы в шаблоне. Если хотите другие значения, меняйте их согласованно в настройках VPS, Nginx и workflow.

Приватный ключ копируйте в Secret через локальный редактор; не добавляйте его в `.env`, YAML, Git или Actions logs. GitHub выдаёт checkout встроенный токен с `contents: read`; личный PAT этому workflow не нужен. [Документация GitHub о Secrets](https://docs.github.com/en/actions/security-for-github-actions/security-guides/using-secrets-in-github-actions).

## 8. Включить workflow

**Локально:** шаблон уже лежит в [docs/deployment/deploy.yml](deployment/deploy.yml). Пока он находится в `docs/`, GitHub его не запускает. После настройки сервера и Secrets:

```sh
cd /home/viis/projects/MiT-viis-2026
mkdir -p .github/workflows
cp docs/deployment/deploy.yml .github/workflows/deploy.yml
git add .github/workflows/deploy.yml
git commit -m "ci: deploy mentorship playground to VPS"
git push origin main
```

Если `.github/workflows/deploy.yml` уже существует, сначала сравните его с шаблоном, а не перезаписывайте. Репозиторий должен разрешать официальные `actions/checkout` и `actions/setup-node`. В примере используются проверенные на момент написания major-теги v7; при строгой политике Actions замените их соответствующими полными commit SHA из официальных репозиториев: [checkout](https://github.com/actions/checkout), [setup-node](https://github.com/actions/setup-node).

Workflow:

1. Забирает исходники, устанавливает Node 22 и зависимости из lockfile.
2. Запускает lint, unit-тесты, TypeScript и production build.
3. Подключается по SSH с проверенным host key.
4. Загружает `dist/` в новый каталог `releases/<commit>-<run>-<attempt>`.
5. Добавляет хешированные assets в общий каталог и атомарно переключает `current`.
6. Проверяет через HTTPS, что `/deployment.txt` содержит ID именно этой публикации.
7. Удаляет временные файлы SSH-ключа с runner.

Параллельные публикации одного репозитория сериализуются через `concurrency`, активный деплой не отменяется новым push. Только `main` может публиковаться, включая ручной запуск. Поведение concurrency описано в [документации GitHub](https://docs.github.com/en/actions/how-tos/deploy/configure-and-manage-deployments/control-deployments).

Браузерный Playwright smoke test уже доступен локально, но не включён в быстрый deploy workflow. При необходимости добавьте после сборки шаги `npx playwright install --with-deps chromium` и `npm run test:e2e` до настройки SSH.

## 9. Первая публикация и дальнейшие обновления

**В GitHub → Actions → Deploy MiT to VPS:** откройте запуск и проверьте все шаги. Затем откройте `SITE_URL`, переключите разделы, создайте тестовую встречу и обновите страницу.

Для повторного ручного деплоя: **Run workflow → main**. Для обновления приложения — обычный commit и push в `main`:

```sh
git add src
# Перед коммитом проверьте diff и отсутствие личных данных.
git diff --cached
git commit -m "feat: update mentorship content"
git push origin main
```

**Изменения в UI не попадают в Git и не запускают Actions.** Профиль, встречи и программа хранятся в LocalStorage конкретного браузера. Чтобы перенести текущие данные с localhost, экспортируйте JSON, откройте конечный HTTPS-домен и импортируйте JSON там. Ментор и менти всё ещё имеют независимые копии.

Деплой на том же origin не очищает LocalStorage. Другой домен, поддомен, порт или переход HTTP → HTTPS означает другое хранилище. Сначала выберите конечный HTTPS-адрес, затем настраивайте рабочие данные. Изменения `seed.ts` применяются к новым браузерам или после подтверждённого сброса, а не поверх существующих записей.

Сайт будет доступен любому, кто знает адрес: авторизации в MVP нет. Все данные, внесённые в исходники/seed, доступны посетителям в JS-сборке даже при private GitHub-репозитории. Пользовательские локальные заметки workflow на сервер не отправляет.

## 10. Откат

Если публикация оборвалась **до** переключения `current`, пользователи остаются на старом релизе. Ошибка HTTPS-проверки **после** переключения помечает Actions красным, но не выполняет автоматический откат.

**На VPS, от администратора:** посмотрите активный и доступные релизы:

```sh
readlink -f /var/www/mit-viis-2026/current
ls -lt /var/www/mit-viis-2026/releases
```

Дождитесь завершения текущего Actions job. Выберите конкретный предыдущий ID и подставьте вместо `PREVIOUS_RELEASE_ID`:

```sh
sudo -u mit-deploy bash <<'ROLLBACK'
set -euo pipefail
root=/var/www/mit-viis-2026
previous=PREVIOUS_RELEASE_ID
test -s "$root/releases/$previous/index.html"
link="$root/current.rollback.$(date +%s)"
ln -s "$root/releases/$previous" "$link"
mv -Tf "$link" "$root/current"
ROLLBACK
```

Nginx перезапускать не нужно. Проверьте сайт и `https://mentor.example.com/deployment.txt`. Откат сборки не откатывает LocalStorage; для пользовательских данных есть JSON backup. Следующий push в `main` снова опубликует текущий код ветки — исправьте или отмените проблемный commit через обычный `git revert`, не переписывая историю.

Старые релизы и shared assets автоматически не удаляются: это упрощает восстановление и сохраняет файлы для открытых вкладок. Периодически проверяйте `du -sh /var/www/mit-viis-2026`. При ручной очистке оставьте активный и несколько предыдущих релизов; shared assets не удаляйте без проверки ссылок из сохраняемых сборок и учёта старых вкладок.

## 11. Если что-то не работает

| Симптом                                 | Что проверить                                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Permission denied (publickey)`         | Приватный ключ в Secret, соответствующий `.pub` в `authorized_keys`, владелец `mit-deploy`, права 700/600. `sudo journalctl -u ssh -n 80`.       |
| `Host key verification failed`          | IP/имя и порт совпадают с known_hosts; fingerprint проверен через консоль. После переустановки VPS проверьте новый ключ перед заменой Secret.    |
| SSH timeout                             | Порт, firewall провайдера, UFW, публичная доступность сервера для runner.                                                                        |
| rsync `Permission denied`               | Каталоги releases/shared принадлежат `mit-deploy`, родительские каталоги доступны.                                                               |
| Nginx 403/404                           | `readlink -f .../current`, наличие index.html, права на весь путь; `sudo tail -n 80 /var/log/nginx/error.log`. Не исправляйте через `chmod 777`. |
| Открывается чужой/default сайт          | DNS и `server_name`, активная конфигурация в sites-enabled, `sudo nginx -t`.                                                                     |
| Certbot не подтверждает домен           | A/AAAA, доступность 80/443, CDN-прокси, firewall.                                                                                                |
| Билд упал на `npm ci`                   | package.json и package-lock.json должны быть согласованы; локально `npm install`, затем commit обоих файлов.                                     |
| Verify public HTTPS release падает      | SITE_URL, сертификат, DNS, содержимое deployment.txt; CDN не должен кэшировать этот файл. Новая сборка уже могла активироваться.                 |
| На сайте пустой профиль                 | Другой origin или браузер: импортируйте JSON. GitHub не хранит ваши изменения из UI.                                                             |
| После обновления остались старые данные | Это ожидаемо для LocalStorage; импортируйте нужную копию или осознанно сбросьте примеры.                                                         |

## Что проверено в репозитории

YAML-шаблон разобран локально, shell-блоки проверены через `bash -n`; сверены пути, имена Secrets и параметры Nginx. Во временном локальном каталоге проверены отказ при неполном релизе, атомарное переключение и сохранение предыдущей версии. Это документация и готовые шаблоны: реальный GitHub Actions run, `nginx -t` на вашем VPS, выпуск сертификата и внешний HTTPS-деплой здесь не выполнялись.
