# Usa un'immagine ufficiale di Nginx su base Linux Alpine
FROM nginx:alpine

# Rimuove la configurazione di default iniziale per sicurezza
RUN rm -f /etc/nginx/conf.d/default.conf

# Copia la tua configurazione personalizzata come TEMPLATE dentro la cartella speciale di Nginx
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copia i file del progetto (modelli 3D, js, html) nella cartella pubblica
COPY . /usr/share/nginx/html

# Indica la porta (documentativo)
EXPOSE $PORT

# IL TRUCCO RISOLUTIVO:
# 1. Forza la rimozione di eventuali default.conf residui rigenerati
# 2. Prende il template pulito, ci inietta la variabile PORT di Railway e lo scrive in conf.d/default.conf
# 3. Avvia Nginx in primo piano
CMD ["/bin/sh", "-c", "rm -f /etc/nginx/conf.d/default.conf && envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]