# Usa un'immagine ufficiale di Nginx su base Linux Alpine (leggera e sicura)
FROM nginx:alpine

# Rimuove la configurazione di default di Nginx per evitare conflitti
RUN rm /etc/nginx/conf.d/default.conf

# Copia della configurazione personalizzata per gestire i file .obj e .mtl
COPY nginx.conf /etc/nginx/nginx.conf

# Copia file progetto dentro la cartella pubblica del server Linux
COPY . /usr/share/nginx/html

# Espone la porta interna del server
EXPOSE 80