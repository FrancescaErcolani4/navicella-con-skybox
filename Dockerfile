FROM nginx:alpine

# Rimuove la configurazione di default iniziale
RUN rm -f /etc/nginx/conf.d/default.conf

# Copia i file del tuo progetto nella cartella pubblica
COPY . /usr/share/nginx/html

# Copia la configurazione pulita (senza http) dentro conf.d
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]