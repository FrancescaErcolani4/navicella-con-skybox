FROM nginx:alpine

# Rimuove la configurazione di default iniziale
RUN rm -f /etc/nginx/conf.d/default.conf

# Copia i file del tuo progetto 3D nella cartella pubblica di Nginx
COPY . /usr/share/nginx/html

# Copia la tua configurazione pulita dentro conf.d come default.conf
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]