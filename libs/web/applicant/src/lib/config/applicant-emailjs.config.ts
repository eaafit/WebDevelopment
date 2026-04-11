/**
 * Клиентская отправка заявки через EmailJS (до появления RPC создания заявки).
 * Заполните поля своими значениями из кабинета EmailJS; при пустом publicKey отправка отключена.
 */
export const applicantEmailJsClientConfig = {
  publicKey: '',
  serviceId: '',
  /** Шаблон заявителю: to_email, full_name, request_summary, submitted_at, app_name, orders_url */
  templateApplicantSubmitted: '',
  /** Шаблон сотруднику: to_email, applicant_email, full_name, request_summary, submitted_at, app_name */
  templateStaffNewRequest: '',
  staffNotifyToEmail: '',
  appName: 'Notary portal',
};
