# Usa un'immagine ufficiale di Nginx su base Linux Alpine
FROM nginx:alpine

# Rimuove la configurazione di default
RUN rm /etc/nginx/conf.d/default.conf

# Copia la tua configurazione personalizzata (che ora chiamiamo come template)
# Nota: La copiamo in un posto speciale dove Nginx può usarla come modello
COPY nginx.conf /etc/nginx/templates/default.conf.template

# Copia i file del progetto (modelli, js, html) nella cartella pubblica
COPY . /usr/share/nginx/html

# Le piattaforme cloud ignorano EXPOSE e usano le proprie porte, 
# ma lasciarlo impostato sulla variabile d'ambiente documenta l'intento.
EXPOSE $PORT

# TRUCCO CLOUD: Sovrascriviamo il comando di avvio.
# Prima di lanciare Nginx, usiamo 'envsubst' (già integrato nell'immagine Alpine)
# per prendere la variabile $PORT passata dal cloud e iniettarla nel file di configurazione.
CMD ["/bin/sh", "-c", "envsubst '${PORT}' < /etc/nginx/templates/default.conf.template > /etc/nginx/conf.d/default.conf && exec nginx -g 'daemon off;'"]