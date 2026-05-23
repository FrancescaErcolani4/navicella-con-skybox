FROM nginx:alpine

# Rimuove qualsiasi file di configurazione secondario che possa fare conflitto
RUN rm -f /etc/nginx/conf.d/*.conf

# Copia i file del tuo progetto 3D nella cartella pubblica di Nginx
COPY . /usr/share/nginx/html

# Spostiamo il tuo nginx.conf personalizzato direttamente come configurazione globale principale
COPY nginx.conf /etc/nginx/nginx.conf

EXPOSE $PORT

# All'avvio, forziamo la pulizia della sottocartella e avviamo Nginx
CMD ["/bin/sh", "-c", "rm -f /etc/nginx/conf.d/*.conf && exec nginx -g 'daemon off;'"]