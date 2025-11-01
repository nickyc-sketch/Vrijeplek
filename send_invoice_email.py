"""
Een voorbeeldscript om een factuur per e‑mail te versturen.

Dit script gebruikt Python's smtplib en email-modules. Voor gebruik moet je
de omgeving variabelen SMTP_SERVER, SMTP_PORT, SMTP_USER en SMTP_PASS
instellen met de gegevens van jouw SMTP-server. Dit kan bijvoorbeeld een
Gmail-SMTP of een dienst zoals Mailgun of SendGrid zijn.

Het script verstuurt een e‑mail met een eenvoudige tekstinhoud en voegt
een factuurbestand als bijlage toe. De factuur kan een HTML-bestand zijn
(zoals invoice-template.html), maar je kunt ook een PDF gebruiken zodra
je die hebt gegenereerd.
"""

import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.mime.application import MIMEApplication
from datetime import datetime


def send_invoice(recipient_email: str, invoice_path: str, invoice_date: str, invoice_number: str, bedrijfsnaam: str) -> None:
    """Verstuur een factuur per e‑mail.

    Parameters:
        recipient_email (str): Het e‑mailadres van de ontvanger.
        invoice_path (str): Pad naar het factuurbestand dat als bijlage wordt verstuurd.
        invoice_date (str): Datum van de factuur (bv. "08-10-2025").
        invoice_number (str): Uniek factuurnummer (bv. "INV-2025-001").
        bedrijfsnaam (str): De naam van het bedrijf van de ontvanger (wordt gebruikt in de aanhef).
    """
    sender = os.environ.get("SMTP_USER")
    password = os.environ.get("SMTP_PASS")
    server = os.environ.get("SMTP_SERVER")
    port = int(os.environ.get("SMTP_PORT", "465"))

    if not all([sender, password, server]):
        raise RuntimeError("Vul de SMTP-instellingen in de omgevingsvariabelen in voordat je dit script gebruikt.")

    # Bouw de e‑mail op
    msg = MIMEMultipart()
    msg['From'] = sender
    msg['To'] = recipient_email
    msg['Subject'] = "Bevestiging aanmelding Vrijeplek – Factuur"

    body = f"""Beste {bedrijfsnaam},

Hartelijk dank voor je aanmelding bij Vrijeplek!

Je hebt gekozen voor ons jaarabonnement à €80 (normaal €108 – je bespaart €28). In de bijlage vind je de factuur met alle details.

Samenvatting:
• Abonnement: Jaarabonnement Vrijeplek
• Factuurdatum: {invoice_date}
• Factuurnummer: {invoice_number}

Bij vragen of onduidelijkheden kun je contact opnemen via info@vrijeplek.be.

Met vriendelijke groeten,
Het Vrijeplek‑team
"""
    msg.attach(MIMEText(body, 'plain', 'utf-8'))

    # Voeg de factuur als bijlage toe
    with open(invoice_path, 'rb') as f:
        attachment = MIMEApplication(f.read(), Name=os.path.basename(invoice_path))
        attachment['Content-Disposition'] = f'attachment; filename="{os.path.basename(invoice_path)}"'
        msg.attach(attachment)

    # Verstuur de e‑mail via een beveiligde SMTP-verbinding
    with smtplib.SMTP_SSL(server, port) as smtp:
        smtp.login(sender, password)
        smtp.sendmail(sender, [recipient_email], msg.as_string())


if __name__ == "__main__":
    # Voorbeeldgebruik: zorg ervoor dat de SMTP-instellingen en ontvanger correct zijn ingevuld.
    example_recipient = "klant@example.com"
    example_invoice_path = "invoice-template.html"  # Gebruik hier een PDF als je die hebt
    example_date = datetime.now().strftime("%d-%m-%Y")
    example_number = "INV-2025-001"
    example_bedrijfsnaam = "Voorbeeld BV"
    send_invoice(example_recipient, example_invoice_path, example_date, example_number, example_bedrijfsnaam)