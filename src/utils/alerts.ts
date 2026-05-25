import Swal from 'sweetalert2';

export const toast = Swal.mixin({
  toast: true,
  position: 'top-end',
  showConfirmButton: false,
  timer: 3000,
  timerProgressBar: true,
  didOpen: (toast) => {
    toast.addEventListener('mouseenter', Swal.stopTimer)
    toast.addEventListener('mouseleave', Swal.resumeTimer)
  }
});

export const showAlert = (title: string, text: string, icon: 'success' | 'error' | 'warning' | 'info' = 'success') => {
  return Swal.fire({
    title,
    text,
    icon,
    confirmButtonColor: '#198754', // MTs Success Green
  });
};

export const showConfirm = (title: string, text: string, confirmButtonText: string = 'Ya, Lanjutkan!') => {
  return Swal.fire({
    title,
    text,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#198754', // Changed to green default
    cancelButtonColor: '#6c757d',
    confirmButtonText,
    cancelButtonText: 'Batal'
  });
};

export const showLoading = (title: string = 'Mohon tunggu...') => {
  Swal.fire({
    title,
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading()
    }
  });
};

export const closeAlert = () => {
  Swal.close();
};
