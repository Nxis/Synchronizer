<?php

// php -S localhost:8000 -t C:\Users\Miroslav\Documents\NetBeansProjects\Tests\public_html

header('Access-Control-Allow-Origin: *');

class Synchronizer {

    private $config;
    private $urn = [];
    
    /**
     * Used synchronizer instance.
     * @var Synchronizer 
     */
    private $synchronizer;

    public function __construct($config) {
        $this->config = $config;
    }

    public function init() {
        // URN processing
        $this->urnProcess();
        $this->urnValidate();
        // synchronizer init
        $this->synchronizerInit();
    }

    private function urnProcess() {
        $urnParts = explode('/', trim(filter_input(INPUT_POST, 'urn'), '/'));

        $this->urn['synchronizerType'] = $urnParts[0];
        $this->urn['link'] = $urnParts[1];
    }

    private function urnValidate() {
        if (!in_array($this->urn['synchronizerType'], array_keys($this->config['availableUrns']))) {
            $this->response(['error' => 'Synchronizer type not available']);
        }
        if (!in_array($this->urn['link'], $this->config['availableUrns'][$this->urn['synchronizerType']])) {
            $this->response(['error' => 'Link not available']);
        }
    }

    private function response($response) {
        echo json_encode($response);
        exit();
    }
    
    private function synchronizerInit(){
        require_once('./Synchronizer.php');
        
        switch ($this->urn['synchronizerType']){
            case 'fileAppending':
                
                require_once('./SynchronizerFileAppending.php');
                $this->synchronizer = new SynchronizerFileAppending();
                
            default:
                $this->response(['error' => 'Link not available']);
        }
    }

}

$config = [
    'availableUrns' => [
        'fileAppending' => ['log1.log']
    ]
];

$synchronizer = new Synchronizer($config);
$synchronizer->init();



